-- CreateEnum
CREATE TYPE "ReplySenderType" AS ENUM ('agent', 'customer');

-- AlterTable: backfill existing rows as 'agent', then drop the default
ALTER TABLE "reply" ADD COLUMN "senderType" "ReplySenderType" NOT NULL DEFAULT 'agent';
ALTER TABLE "reply" ALTER COLUMN "senderType" DROP DEFAULT;
