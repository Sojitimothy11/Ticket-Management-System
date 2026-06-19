-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "marked" BOOLEAN NOT NULL DEFAULT false;
