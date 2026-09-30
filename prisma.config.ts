import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly (not env()) so `prisma generate` works without a database.
    url: process.env.kosh_DATABASE_URL ?? "",
  },
});
