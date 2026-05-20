-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByAI" BOOLEAN NOT NULL DEFAULT false;
