## IMEI Intake Dashboard

Single-page dashboard for phone resellers to scan IMEIs, call the SickW API, log responses in SQLite via Prisma, and mirror every successful lookup to Google Sheets.

### Tech Stack

- Next.js App Router + TypeScript + Tailwind CSS
- SQLite + Prisma for the lookup log / cache
- SickW REST API wrapper
- Google Sheets API (service account + append-only helper)

### Environment Variables

Copy `env.example` to `.env` and fill in the values:

```
DATABASE_URL="file:./prisma/dev.db"
SICKW_API_KEY="..."
SICKW_DEFAULT_SERVICE_ID="..."
SICKW_API_BASE_URL="https://sickw.com/api.php"
GOOGLE_SHEETS_ID="..."
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Keep the private key on a single line and replace literal newlines with `\n`.

### Setup

```bash
npm install
npm run prisma:migrate   # creates the Lookup table locally
```

### Testing the Flow

1. Duplicate `env.example` to `.env` and populate all SickW/Google credentials.
2. Run `npm run dev`.
3. Visit `http://localhost:3000`, scan or type an IMEI, pick a service (or leave the default), then press Enter.
4. On success you should see:
   - Device metadata card (brand, model, carrier, locks, etc.)
   - Provider meta (service name/id, price, balance aftermath)
   - Row appended to Google Sheets (if Sheets creds are present)
   - Entry stored in SQLite and displayed under “Recent scans”.

If SickW responds with an error (E01, R01, B01, etc.) the backend returns a friendly JSON payload `{ error, code }` which the UI surfaces. Those failures are also stored in the `Lookup` table for auditing.

### SickW Services & Admin Utilities

- Curated instant services live in `src/config/sickwServices.ts`. Update this file to add or rename quick-pick options in the dropdown.
- Admin/debug API routes:
  - `GET /api/sickw/balance` → `{ balance }`
  - `GET /api/sickw/services` → raw list from `action=services`
- Main workflow API routes:
  - `POST /api/check-imei`
  - `GET /api/recent-lookups`

### Development

```bash
npm run dev
# App is available at http://localhost:3000
```

The dashboard lets you:

1. Scan or type IMEIs (form is optimized for hardware scanners).
2. Hit `/api/check-imei` which validates, checks the SQLite cache, calls SickW when needed, writes to the `Lookup` table, and appends to Google Sheets.
3. View the normalized device card plus the last ~10 scans in the “Recent scans” table (powered by `/api/recent-lookups`).

### Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js with Turbopack |
| `npm run build` | Production build |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm install` | Also runs `prisma generate` via postinstall |
