-- AlterTable
ALTER TABLE "Order" ADD COLUMN "realizedPnL" DECIMAL(18,8);

-- AlterTable
ALTER TABLE "SimulationAccount" ALTER COLUMN "balance" SET DEFAULT 5000.00;
