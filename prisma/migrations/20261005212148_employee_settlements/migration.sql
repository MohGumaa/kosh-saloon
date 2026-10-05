-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "EmployeeSettlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalRevenue" DECIMAL(12,2) NOT NULL,
    "sharePercentage" DECIMAL(5,2) NOT NULL,
    "employeeShare" DECIMAL(12,2) NOT NULL,
    "totalExpenses" DECIMAL(12,2) NOT NULL,
    "totalAdjustments" DECIMAL(12,2) NOT NULL,
    "finalAmount" DECIMAL(12,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeSettlement_periodStart_idx" ON "EmployeeSettlement"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSettlement_employeeId_periodStart_key" ON "EmployeeSettlement"("employeeId", "periodStart");

-- AddForeignKey
ALTER TABLE "EmployeeSettlement" ADD CONSTRAINT "EmployeeSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSettlement" ADD CONSTRAINT "EmployeeSettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSettlement" ADD CONSTRAINT "EmployeeSettlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
