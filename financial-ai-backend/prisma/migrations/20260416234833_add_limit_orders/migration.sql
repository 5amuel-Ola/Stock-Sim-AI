-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'OPEN';
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "limitPrice" DECIMAL(18,8),
ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'MARKET',
ALTER COLUMN "fillPrice" DROP NOT NULL,
ALTER COLUMN "totalValue" DROP NOT NULL;
