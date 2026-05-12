import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL ?? process.env.PG_URI ?? process.env.DATABASE_URI;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Set it in .env or as an environment variable.');
}

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });