-- AlterEnum
ALTER TYPE "CustomerType" ADD VALUE 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "city" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "website" TEXT;
