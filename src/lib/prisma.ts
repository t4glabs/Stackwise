import { PrismaClient } from "../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter. We use libSQL locally (file:./dev.db,
// zero native compilation) and Postgres in production — selected by DATABASE_URL scheme,
// so the only thing that changes between dev and the Hetzner box is the .env value.
function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  const adapter = url.startsWith("file:")
    ? new PrismaLibSql({ url })
    : new PrismaPg({ connectionString: url });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
