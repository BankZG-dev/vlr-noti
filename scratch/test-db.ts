import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL
});

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log("Success:", result);
  } catch (err) {
    console.error("DB Error:", err);
  }
}

main();
