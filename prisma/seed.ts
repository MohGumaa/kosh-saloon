// Creates the first ADMIN from SEED_ADMIN_* env vars. Never overwrites.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { seedAdminSchema } from "../lib/auth/validation";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.kosh_DATABASE_URL }),
});

async function main() {
  if (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) {
    console.log("An admin already exists; nothing to seed.");
    return;
  }

  const parsed = seedAdminSchema.safeParse({
    name: process.env.SEED_ADMIN_NAME,
    username: process.env.SEED_ADMIN_USERNAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `Invalid or missing SEED_ADMIN_* values: ${fields.join(", ")}. ` +
        "Username: lowercase letters, digits, dot, underscore, or hyphen. Password: 8-128 characters.",
    );
  }

  const { name, username, email, password } = parsed.data;
  await db.user.create({
    data: { name, username, email, role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  console.log(`Created admin "${username}".`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
