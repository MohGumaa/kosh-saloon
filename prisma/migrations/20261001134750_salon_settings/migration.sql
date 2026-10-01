-- CreateTable
CREATE TABLE "SalonSettings" (
    "id" TEXT NOT NULL DEFAULT 'salon',
    "name" TEXT NOT NULL DEFAULT 'Kosh Salon',
    "licenseNumber" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "employeeSharePercentage" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonSettings_pkey" PRIMARY KEY ("id")
);
