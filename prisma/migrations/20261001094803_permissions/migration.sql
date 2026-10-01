-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The permission catalog. Keys must match PERMISSION_KEYS in lib/auth/permissions.ts.
INSERT INTO "Permission" ("id", "key", "name", "description", "updatedAt") VALUES
    (gen_random_uuid()::text, 'employees.view', 'View employees', 'See the employee list and employee profiles.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employees.create', 'Create employees', 'Add new employee accounts.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employees.edit', 'Edit employees', 'Change employee profiles and account details.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employees.delete', 'Delete employees', 'Remove employee accounts.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employees.activate', 'Activate employees', 'Activate or deactivate employee accounts.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'services.view', 'View services', 'See the service catalog.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'services.create', 'Create services', 'Add services to the catalog.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'services.edit', 'Edit services', 'Change service names, prices, and status.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'services.delete', 'Delete services', 'Remove services from the catalog.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'invoices.view', 'View invoices', 'See invoices.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'invoices.create', 'Create invoices', 'Record new invoices.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'invoices.edit', 'Edit invoices', 'Change existing invoices.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'invoices.delete', 'Delete invoices', 'Cancel invoices; invoices are never hard-deleted.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'invoices.change_status', 'Change invoice status', 'Mark invoices as paid or unpaid.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'expenses.view', 'View salon expenses', 'See salon expenses.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'expenses.create', 'Create salon expenses', 'Record salon expenses.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'expenses.edit', 'Edit salon expenses', 'Change salon expenses.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'expenses.delete', 'Delete salon expenses', 'Remove salon expenses.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employee_expenses.view', 'View employee expenses', 'See employee deductions.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employee_expenses.create', 'Create employee expenses', 'Record employee deductions.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employee_expenses.edit', 'Edit employee expenses', 'Change employee deductions.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employee_expenses.delete', 'Delete employee expenses', 'Remove employee deductions.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'reports.view', 'View reports', 'See salon reports.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'reports.view_all_employees', 'View all employees in reports', 'See report figures for every employee.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'reports.view_own_performance', 'View own performance', 'See your own performance report.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settlements.view', 'View settlements', 'See monthly settlements.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settlements.create', 'Create settlements', 'Generate and calculate monthly settlements.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settlements.approve', 'Approve settlements', 'Approve calculated settlements.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settlements.mark_paid', 'Mark settlements as paid', 'Mark approved settlements as paid, which locks them.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settings.view', 'View settings', 'See salon settings.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settings.edit', 'Edit settings', 'Change salon information and financial settings.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'settings.security', 'Manage security settings', 'Change security settings.', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'permissions.manage', 'Manage permissions', 'Give or remove permissions for Supervisor and Staff users.', CURRENT_TIMESTAMP);
