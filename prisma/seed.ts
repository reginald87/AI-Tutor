import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const isProd = process.env.NODE_ENV === "production";

async function main() {
  await prisma.setting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      defaultPromptsPerDay: 5,
      defaultPromptsPerWeek: 35,
      defaultModel: process.env.OLLAMA_MODEL || "llama3.2:latest",
    },
  });

  // Admin password MUST come from the environment in production. In dev we fall
  // back to a clearly dev-only value, but it is still flagged mustChangePassword
  // so the operator is forced to set a real password on first login.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (isProd && !adminPassword) {
    throw new Error(
      "FATAL: ADMIN_PASSWORD environment variable is required to seed the admin user in production."
    );
  }
  const adminPlain = adminPassword || "DevAdmin#2026!ChangeMe";

  const adminEmail = "admin@bmu.edu.ng";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminHash = await bcrypt.hash(adminPlain, 10);

  if (!existing) {
    await prisma.user.create({
      data: {
        name: "BMU Administrator",
        email: adminEmail,
        passwordHash: adminHash,
        role: "ADMIN",
        verified: true,
        mustChangePassword: true,
        promptsPerDay: 999,
        promptsPerWeek: 9999,
      },
    });
    console.log(`✓ Admin user created: ${adminEmail}  (must change password on first login)`);
  } else {
    // Force a password change and refresh the hash if it is still the old default.
    await prisma.user.update({
      where: { email: adminEmail },
      data: { mustChangePassword: true, passwordHash: adminHash },
    });
    console.log("• Admin user ensured (mustChangePassword = true).");
  }

  // Demo student is for local/dev testing only — never seed it in production.
  if (!isProd) {
    const demoEmail = "student@bmu.edu.ng";
    const demo = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!demo) {
      const demoHash = await bcrypt.hash("DevStudent#2026!ChangeMe", 10);
      await prisma.user.create({
        data: {
          name: "Demo Student",
          email: demoEmail,
          passwordHash: demoHash,
          matricNumber: "BMU/21/0001",
          faculty: "Basic Medical Sciences",
          department: "Anatomy",
          program: "MBBS",
          level: "200",
          verified: true,
          mustChangePassword: true,
          promptsPerDay: 5,
          promptsPerWeek: 35,
        },
      });
      console.log(`✓ Demo student created: ${demoEmail}  (must change password on first login)`);
    }
  } else {
    console.log("• Skipped demo student (production seed).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
