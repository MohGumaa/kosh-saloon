-- CreateEnum
CREATE TYPE "EmployeeExpenseCategory" AS ENUM ('CASH_ADVANCE', 'ADVANCE_SALARY', 'WITHDRAWAL', 'PERSONAL_PURCHASE', 'OTHER');

-- CreateTable
CREATE TABLE "EmployeeExpense" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "EmployeeExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeExpense_employeeId_date_idx" ON "EmployeeExpense"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeExpense" ADD CONSTRAINT "EmployeeExpense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExpense" ADD CONSTRAINT "EmployeeExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
