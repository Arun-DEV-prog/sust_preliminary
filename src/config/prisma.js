const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/mock_sust?schema=public",
    },
  },
});

async function ensureTicketAnalysisTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."ticket_analyses" (
        "id" TEXT NOT NULL,
        "ticketId" TEXT NOT NULL,
        "relevantTransactionId" TEXT,
        "evidenceVerdict" TEXT NOT NULL,
        "caseType" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION NOT NULL,
        "humanReviewRequired" BOOLEAN NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ticket_analyses_pkey" PRIMARY KEY ("id")
      )
    `);
    return true;
  } catch (error) {
    console.warn("Unable to ensure ticket_analyses table:", error.message);
    return false;
  }
}

async function connectPrisma() {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    await prisma.$connect();
    await ensureTicketAnalysisTable();
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = { prisma, connectPrisma };
