-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "autoResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
