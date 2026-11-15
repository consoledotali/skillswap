import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "DATABASE_URL is not set. Database requests will fail until server/.env is configured.",
  );
}

const pool = connectionString
  ? new pg.Pool({ connectionString, max: 20 })
  : undefined;

const adapter = pool ? new PrismaPg(pool) : undefined;

const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();

export default prisma;
