import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type GatePageProps = {
  searchParams: { redirect?: string };
};

const APP_TOKEN = process.env.APP_ACCESS_TOKEN;

const setToken = async (formData: FormData) => {
  "use server";
  const token = (formData.get("token") as string | null)?.trim() ?? "";
  const redirectTo = (formData.get("redirect") as string | null) ?? "/";

  if (!APP_TOKEN) {
    redirect(redirectTo);
  }

  if (token !== APP_TOKEN) {
    redirect(`/gate?error=invalid&redirect=${encodeURIComponent(redirectTo)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("app_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(redirectTo || "/");
};

export default function GatePage({ searchParams }: GatePageProps) {
  const error = searchParams?.error === "invalid";
  const redirectTo = searchParams?.redirect ?? "/";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-fuchsia-500/10 backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/80">
            imeiTool
          </p>
          <h1 className="text-2xl font-semibold text-white">Enter access code</h1>
          <p className="text-sm text-slate-300">
            This workspace is protected. Please enter the passcode provided to you.
          </p>
        </div>

        <form action={setToken} className="mt-6 space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="token">
              Access code
            </label>
            <input
              id="token"
              name="token"
              type="password"
              required
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 shadow-inner shadow-black/10 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              placeholder="Enter code"
            />
          </div>
          {error && (
            <p className="text-sm text-red-200">
              Invalid code. Please try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/40 transition hover:brightness-110"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

