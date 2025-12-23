/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "ibrahim@imet-tool.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const tenantName = process.env.SEED_TENANT_NAME || "Default Tenant";

  const passwordHash = await bcrypt.hash(password, 10);

  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
      },
    });
    console.log(`Created tenant: ${tenant.name}`);
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        memberships: {
          create: {
            tenantId: tenant.id,
            role: "admin",
          },
        },
      },
    });
    console.log(`Created admin user: ${email}`);
  } else {
    console.log(`User ${email} already exists; skipping.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




