-- CreateTable
CREATE TABLE "SettlementAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceSettlementId" TEXT NOT NULL,
    "appliedSettlementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettlementAdjustment_employeeId_appliedSettlementId_idx" ON "SettlementAdjustment"("employeeId", "appliedSettlementId");

-- CreateIndex
CREATE INDEX "SettlementAdjustment_sourceSettlementId_idx" ON "SettlementAdjustment"("sourceSettlementId");

-- CreateIndex
CREATE INDEX "SettlementAdjustment_appliedSettlementId_idx" ON "SettlementAdjustment"("appliedSettlementId");

-- AddForeignKey
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_sourceSettlementId_fkey" FOREIGN KEY ("sourceSettlementId") REFERENCES "EmployeeSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_appliedSettlementId_fkey" FOREIGN KEY ("appliedSettlementId") REFERENCES "EmployeeSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
