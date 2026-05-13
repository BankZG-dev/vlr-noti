import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Support both local SQLite and cloud PostgreSQL
const dbProvider = process.env.DATABASE_LOCAL === "true" ? "sqlite" : "postgresql";
const dbUrl = process.env.DATABASE_LOCAL === "true" 
  ? "file:./prisma/local.db" 
  : env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    provider: dbProvider,
    url: dbUrl,
  },
});