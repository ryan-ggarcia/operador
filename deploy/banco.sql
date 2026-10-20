-- Banco do operador: cria os schemas e as tabelas de todos os módulos.
-- Gerado a partir de backend/prisma/migrations (não editar à mão).
-- Migrações incluídas: 20261013000000_init, 20261014120000_media_line_discount.
-- Rodar uma vez num banco vazio (ex.: SQL Editor do Supabase). Depois disso o
-- back aplica sozinho, ao subir, só as migrações que vierem depois destas.
-- Não inclui dados: perfis, status e o dono da conta vêm do seed (npm run seed).

BEGIN;

-- ===== 20261013000000_init =====
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "access";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "files";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "media";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "production";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "projects";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "settings";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "timesheet";

-- CreateEnum
CREATE TYPE "access"."PersonType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "crm"."PartyPersonType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "finance"."BillKind" AS ENUM ('REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "finance"."BillPartyType" AS ENUM ('CLIENT', 'SUPPLIER', 'PROVIDER', 'VEHICLE', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "finance"."BillCondition" AS ENUM ('SINGLE', 'INSTALLMENTS', 'RECURRING');

-- CreateEnum
CREATE TYPE "finance"."BillSourceType" AS ENUM ('MANUAL', 'MEDIA', 'PRODUCTION', 'PROJECT', 'JOB', 'TRANSFER');

-- CreateEnum
CREATE TYPE "finance"."BillInvoiceClass" AS ENUM ('AGENCY_RECEIVES_COMMISSION_CLIENT', 'AGENCY_RECEIVES_COMMISSION_THIRD_PARTY', 'AGENCY_RECEIVES_NET_CLIENT', 'AGENCY_RECEIVES_TOTAL_CLIENT', 'AGENCY_PAYS_NET_THIRD_PARTY', 'AGENCY_PAYS_TOTAL_THIRD_PARTY', 'FEE');

-- CreateEnum
CREATE TYPE "finance"."BillSituation" AS ENUM ('OPEN', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "finance"."CategoryKind" AS ENUM ('REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "media"."MediaType" AS ENUM ('TV', 'RADIO', 'NEWSPAPER', 'MAGAZINE', 'OOH', 'INTERNET', 'OTHER');

-- CreateEnum
CREATE TYPE "media"."MediaSituation" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "media"."ValueType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "media"."BillingType" AS ENUM ('FLCC', 'FBCC', 'FLCA', 'FL_CCA', 'FBCA');

-- CreateEnum
CREATE TYPE "media"."NetworkType" AS ENUM ('OPEN_TV', 'PAY_TV', 'RADIO', 'OTHER');

-- CreateEnum
CREATE TYPE "production"."ProductionSituation" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "production"."ProductionValueType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "production"."ProductionBillingType" AS ENUM ('FLCC', 'FBCC', 'FLCA', 'FL_CCA', 'FBCA');

-- CreateEnum
CREATE TYPE "production"."PredefinedTextKind" AS ENUM ('PAYMENT_CONDITION', 'CLIENT_NOTE', 'SUPPLIER_NOTE', 'BRIEFING');

-- CreateEnum
CREATE TYPE "projects"."ProjectSituation" AS ENUM ('OPEN', 'ARCHIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "projects"."JobSituation" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "projects"."ProjectDocType" AS ENUM ('PROJECT', 'JOB');

-- CreateEnum
CREATE TYPE "projects"."ApprovalSituation" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "projects"."ApprovalDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "timesheet"."TimeEntryDocType" AS ENUM ('JOB', 'TASK', 'MEDIA', 'PRODUCTION', 'PROJECT');

-- CreateEnum
CREATE TYPE "timesheet"."TimeEntrySource" AS ENUM ('TIMER', 'MANUAL');

-- CreateEnum
CREATE TYPE "timesheet"."TimeEntryKind" AS ENUM ('NORMAL', 'REWORK');

-- CreateEnum
CREATE TYPE "timesheet"."TimeEntrySituation" AS ENUM ('RUNNING', 'DONE');

-- CreateTable
CREATE TABLE "access"."user_account" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarFileId" UUID,
    "signatureFileId" UUID,
    "color" TEXT,
    "accessProfileId" UUID,
    "customPermissions" JSONB,
    "permissionsVersion" INTEGER NOT NULL DEFAULT 1,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "collaboratorId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."access_profile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "access_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."collaborator" (
    "id" UUID NOT NULL,
    "personType" "access"."PersonType" NOT NULL DEFAULT 'PF',
    "name" TEXT NOT NULL,
    "document" TEXT,
    "legalName" TEXT,
    "rg" TEXT,
    "birthDate" DATE,
    "phone" TEXT,
    "email" TEXT,
    "address" JSONB,
    "positionId" UUID,
    "admissionDate" DATE,
    "dismissalDate" DATE,
    "grossSalary" DECIMAL(14,2),
    "totalCost" DECIMAL(14,2),
    "hourlyRate" DECIMAL(14,2),
    "benefits" JSONB,
    "bankData" JSONB,
    "pixKeys" JSONB,
    "cvUrl" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "collaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."position" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."team_member" (
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "access"."refresh_token" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."party" (
    "id" UUID NOT NULL,
    "personType" "crm"."PartyPersonType" NOT NULL DEFAULT 'PJ',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "document" TEXT,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "email" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "website" TEXT,
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'Brasil',
    "isClient" BOOLEAN NOT NULL DEFAULT false,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "isProvider" BOOLEAN NOT NULL DEFAULT false,
    "isVehicle" BOOLEAN NOT NULL DEFAULT false,
    "clientGroupId" UUID,
    "bankData" JSONB,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."contact" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "departmentId" UUID,
    "phone1" TEXT,
    "phone2" TEXT,
    "birthDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."client_group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "client_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."party_note" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "party_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files"."file" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "ownerModule" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "description" TEXT,
    "uploadedById" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."bill" (
    "id" UUID NOT NULL,
    "installmentGroupId" UUID,
    "kind" "finance"."BillKind" NOT NULL,
    "partyType" "finance"."BillPartyType" NOT NULL,
    "partyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "paymentMethodId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "additions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discounts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(14,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidAt" DATE,
    "competenceDate" DATE,
    "billingDate" DATE,
    "installmentNumber" INTEGER NOT NULL DEFAULT 1,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "condition" "finance"."BillCondition" NOT NULL DEFAULT 'SINGLE',
    "documentNumber" TEXT,
    "referenceNumber" TEXT,
    "clientId" UUID,
    "sourceType" "finance"."BillSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" UUID,
    "invoiceClass" "finance"."BillInvoiceClass",
    "projectId" UUID,
    "statusId" UUID,
    "situation" "finance"."BillSituation" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."bill_cost_center" (
    "billId" UUID NOT NULL,
    "costCenterId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "percent" DECIMAL(7,4),

    CONSTRAINT "bill_cost_center_pkey" PRIMARY KEY ("billId","costCenterId")
);

-- CreateTable
CREATE TABLE "finance"."bill_adjustment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "adjustmentTypeId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "bill_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."transfer" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "outBillId" UUID,
    "inBillId" UUID,
    "scheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "kind" "finance"."CategoryKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."account" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT,
    "accountType" TEXT,
    "agency" TEXT,
    "number" TEXT,
    "initialBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payment_method" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."cost_center" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."adjustment_type" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sign" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "adjustment_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."status" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."media" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "mediaType" "media"."MediaType" NOT NULL,
    "vehicleId" UUID,
    "vehicleContactId" UUID,
    "networkId" UUID,
    "channel" TEXT,
    "target" TEXT,
    "estimateNumber" TEXT,
    "responsibleId" UUID,
    "requesterId" UUID,
    "statusId" UUID,
    "situation" "media"."MediaSituation" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMPTZ(3),
    "documentDate" DATE,
    "commissionType" "media"."ValueType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "negotiatedCommission" DECIMAL(14,4),
    "feeType" "media"."ValueType" NOT NULL DEFAULT 'PERCENT',
    "feeValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "discountType" "media"."ValueType" NOT NULL DEFAULT 'AMOUNT',
    "discountValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bonusTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "billingType" "media"."BillingType",
    "firstDueDate" DATE,
    "paymentCondition" TEXT,
    "vehicleNotes" TEXT,
    "clientNotes" TEXT,
    "briefing" TEXT,
    "pdfPreferences" JSONB,
    "sentToFinanceAt" TIMESTAMPTZ(3),
    "snapshot" JSONB,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."media_member" (
    "mediaId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "media_member_pkey" PRIMARY KEY ("mediaId","userId")
);

-- CreateTable
CREATE TABLE "media"."media_piece" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "letter" VARCHAR(3) NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "media_piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."media_grid" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "marketId" UUID,
    "periodStart" DATE,
    "periodEnd" DATE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "replicaGroupId" UUID,

    CONSTRAINT "media_grid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."media_line" (
    "id" UUID NOT NULL,
    "gridId" UUID NOT NULL,
    "pieceId" UUID,
    "programId" UUID,
    "priceTableRowId" UUID,
    "product" TEXT,
    "location" TEXT,
    "section" TEXT,
    "position" TEXT,
    "color" TEXT,
    "format" TEXT,
    "placementType" TEXT,
    "costMetricId" UUID,
    "startDate" DATE,
    "endDate" DATE,
    "biweeks" JSONB,
    "dailyInsertions" JSONB,
    "insertions" INTEGER NOT NULL DEFAULT 0,
    "unitValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "media_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."media_installment" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "billingDate" DATE,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethodId" UUID,
    "financeBillId" UUID,

    CONSTRAINT "media_installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."status" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ignoresDelay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."network" (
    "id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "mnemonic" TEXT NOT NULL,
    "type" "media"."NetworkType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."program" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mnemonic" TEXT NOT NULL,
    "networkId" UUID NOT NULL,
    "channel" TEXT,
    "mediaType" "media"."MediaType" NOT NULL,
    "airingDays" INTEGER[],
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."price_table" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "mediaType" "media"."MediaType" NOT NULL,
    "mnemonic" TEXT,
    "networkId" UUID,
    "channel" TEXT,
    "marketId" UUID,
    "validFrom" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."price_table_row" (
    "id" UUID NOT NULL,
    "priceTableId" UUID NOT NULL,
    "programId" UUID,
    "section" TEXT,
    "position" TEXT,
    "color" TEXT,
    "format" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "price_table_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."market" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "state" VARCHAR(2),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."cost_metric" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."predefined_briefing" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "predefined_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "payload" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."preference" (
    "userId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "preference_pkey" PRIMARY KEY ("userId","event")
);

-- CreateTable
CREATE TABLE "production"."production" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "clientId" UUID NOT NULL,
    "clientContactId" UUID,
    "title" TEXT NOT NULL,
    "responsibleId" UUID,
    "requesterId" UUID,
    "statusId" UUID,
    "situation" "production"."ProductionSituation" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMPTZ(3),
    "validityDays" INTEGER,
    "taxId" UUID,
    "taxPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "paymentConditions" TEXT,
    "clientNotes" TEXT,
    "briefing" TEXT,
    "pdfPreferences" JSONB,
    "totalValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."production_member" (
    "productionId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "production_member_pkey" PRIMARY KEY ("productionId","userId")
);

-- CreateTable
CREATE TABLE "production"."item" (
    "id" UUID NOT NULL,
    "productionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantities" DECIMAL(14,4)[],
    "commissionType" "production"."ProductionValueType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "feeType" "production"."ProductionValueType" NOT NULL DEFAULT 'PERCENT',
    "feeValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."item_supplier" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "estimateNumber" TEXT,
    "dueDate" DATE,
    "orderGroup" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."quote" (
    "id" UUID NOT NULL,
    "itemSupplierId" UUID NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitValue" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feeValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."purchase_order" (
    "id" UUID NOT NULL,
    "productionId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "orderGroup" INTEGER NOT NULL DEFAULT 0,
    "billingType" "production"."ProductionBillingType",
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "negotiatedCommission" DECIMAL(14,2),
    "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valueToPass" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplierNotes" TEXT,
    "deliveryPlace" TEXT,
    "deliveryDate" DATE,
    "firstDueDate" DATE,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "sentToFinanceAt" TIMESTAMPTZ(3),
    "snapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."purchase_order_installment" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "billingDate" DATE,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethodId" UUID,
    "financeBillId" UUID,

    CONSTRAINT "purchase_order_installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."status" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ignoresDelay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."tax" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."predefined_text" (
    "id" UUID NOT NULL,
    "kind" "production"."PredefinedTextKind" NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "predefined_text_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "description" TEXT,
    "requesterId" UUID,
    "responsibleId" UUID,
    "statusId" UUID,
    "situation" "projects"."ProjectSituation" NOT NULL DEFAULT 'OPEN',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "isClientDefault" BOOLEAN NOT NULL DEFAULT false,
    "desiredDeadline" TIMESTAMPTZ(3),
    "budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastDocumentSequence" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMPTZ(3),
    "situationChangedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_member" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "projects"."project_favorite" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "project_favorite_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "projects"."job" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "clientId" UUID NOT NULL,
    "clientContactId" UUID,
    "responsibleId" UUID,
    "requesterId" UUID,
    "statusId" UUID,
    "situation" "projects"."JobSituation" NOT NULL DEFAULT 'OPEN',
    "startAt" TIMESTAMPTZ(3),
    "deadline" TIMESTAMPTZ(3),
    "deadlineHasTime" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "briefing" TEXT,
    "recurrence" JSONB,
    "closedAt" TIMESTAMPTZ(3),
    "situationChangedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."job_member" (
    "jobId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "job_member_pkey" PRIMARY KEY ("jobId","userId")
);

-- CreateTable
CREATE TABLE "projects"."task" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "responsibleId" UUID,
    "statusId" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMPTZ(3),
    "deadline" TIMESTAMPTZ(3),
    "situation" "projects"."JobSituation" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."task_dependency" (
    "taskId" UUID NOT NULL,
    "dependsOnTaskId" UUID NOT NULL,

    CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("taskId","dependsOnTaskId")
);

-- CreateTable
CREATE TABLE "projects"."briefing_version" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "html" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."status" (
    "id" UUID NOT NULL,
    "docType" "projects"."ProjectDocType" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ignoresDelay" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "groupId" UUID,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."status_group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "status_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."comment" (
    "id" UUID NOT NULL,
    "docType" "projects"."ProjectDocType" NOT NULL,
    "docId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "html" TEXT NOT NULL,
    "mentionedUserIds" UUID[],
    "parentId" UUID,
    "fileId" UUID,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."approval_request" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "docType" "projects"."ProjectDocType" NOT NULL,
    "docId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "approverIds" UUID[],
    "deadline" TIMESTAMPTZ(3),
    "situation" "projects"."ApprovalSituation" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."approval_vote" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "decision" "projects"."ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."approval_marker" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "x" DECIMAL(7,4) NOT NULL,
    "y" DECIMAL(7,4) NOT NULL,
    "html" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_marker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."predefined_briefing" (
    "id" UUID NOT NULL,
    "docType" "projects"."ProjectDocType" NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "predefined_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_template" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "briefing" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."template_job" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "responsibleId" UUID,
    "statusId" UUID,
    "briefing" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."template_task" (
    "id" UUID NOT NULL,
    "templateJobId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "responsibleId" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "dependsOnIds" UUID[],

    CONSTRAINT "template_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."history" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings"."agency" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "cnpj" TEXT,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "logoFileId" UUID,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet"."time_entry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "docType" "timesheet"."TimeEntryDocType" NOT NULL,
    "docId" UUID NOT NULL,
    "projectId" UUID,
    "clientId" UUID,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "source" "timesheet"."TimeEntrySource" NOT NULL DEFAULT 'TIMER',
    "kind" "timesheet"."TimeEntryKind" NOT NULL DEFAULT 'NORMAL',
    "description" TEXT,
    "situation" "timesheet"."TimeEntrySituation" NOT NULL DEFAULT 'RUNNING',
    "hourlyCost" DECIMAL(14,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet"."work_schedule" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "productiveGoalMinutesPerDay" INTEGER,
    "periods" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet"."user_schedule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "validFrom" DATE NOT NULL,

    CONSTRAINT "user_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "access"."user_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_collaboratorId_key" ON "access"."user_account"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "access_profile_name_key" ON "access"."access_profile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "collaborator_document_key" ON "access"."collaborator"("document");

-- CreateIndex
CREATE UNIQUE INDEX "position_name_key" ON "access"."position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "access"."team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "access"."refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_userId_idx" ON "access"."refresh_token"("userId");

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "access"."history"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "party_document_key" ON "crm"."party"("document");

-- CreateIndex
CREATE INDEX "party_name_idx" ON "crm"."party"("name");

-- CreateIndex
CREATE INDEX "party_isClient_active_idx" ON "crm"."party"("isClient", "active");

-- CreateIndex
CREATE INDEX "contact_partyId_idx" ON "crm"."contact"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "crm"."department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "client_group_name_key" ON "crm"."client_group"("name");

-- CreateIndex
CREATE INDEX "party_note_partyId_idx" ON "crm"."party_note"("partyId");

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "crm"."history"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "file_storageKey_key" ON "files"."file"("storageKey");

-- CreateIndex
CREATE INDEX "file_ownerModule_ownerType_ownerId_idx" ON "files"."file"("ownerModule", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "bill_kind_situation_dueDate_idx" ON "finance"."bill"("kind", "situation", "dueDate");

-- CreateIndex
CREATE INDEX "bill_sourceType_sourceId_idx" ON "finance"."bill"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "bill_clientId_idx" ON "finance"."bill"("clientId");

-- CreateIndex
CREATE INDEX "bill_partyType_partyId_idx" ON "finance"."bill"("partyType", "partyId");

-- CreateIndex
CREATE INDEX "bill_installmentGroupId_idx" ON "finance"."bill"("installmentGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_outBillId_key" ON "finance"."transfer"("outBillId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_inBillId_key" ON "finance"."transfer"("inBillId");

-- CreateIndex
CREATE UNIQUE INDEX "account_one_default_key" ON "finance"."account"("isDefault") WHERE ("isDefault" = true);

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_name_key" ON "finance"."payment_method"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cost_center_name_key" ON "finance"."cost_center"("name");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_type_name_key" ON "finance"."adjustment_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "status_name_key" ON "finance"."status"("name");

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "finance"."history"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "media_clientId_idx" ON "media"."media"("clientId");

-- CreateIndex
CREATE INDEX "media_vehicleId_idx" ON "media"."media"("vehicleId");

-- CreateIndex
CREATE INDEX "media_situation_deadline_idx" ON "media"."media"("situation", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "media_projectId_sequence_key" ON "media"."media"("projectId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "media_piece_mediaId_letter_key" ON "media"."media_piece"("mediaId", "letter");

-- CreateIndex
CREATE INDEX "media_grid_mediaId_idx" ON "media"."media_grid"("mediaId");

-- CreateIndex
CREATE INDEX "media_line_gridId_idx" ON "media"."media_line"("gridId");

-- CreateIndex
CREATE UNIQUE INDEX "media_installment_mediaId_number_key" ON "media"."media_installment"("mediaId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "network_mnemonic_key" ON "media"."network"("mnemonic");

-- CreateIndex
CREATE UNIQUE INDEX "program_networkId_mnemonic_key" ON "media"."program"("networkId", "mnemonic");

-- CreateIndex
CREATE INDEX "price_table_vehicleId_validFrom_idx" ON "media"."price_table"("vehicleId", "validFrom");

-- CreateIndex
CREATE INDEX "price_table_row_priceTableId_idx" ON "media"."price_table_row"("priceTableId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_metric_name_key" ON "media"."cost_metric"("name");

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "media"."history"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notifications"."notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "production_clientId_idx" ON "production"."production"("clientId");

-- CreateIndex
CREATE INDEX "production_situation_deadline_idx" ON "production"."production"("situation", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "production_projectId_sequence_key" ON "production"."production"("projectId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "item_productionId_sequence_key" ON "production"."item"("productionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "item_supplier_itemId_supplierId_key" ON "production"."item_supplier"("itemId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_itemSupplierId_quantity_key" ON "production"."quote"("itemSupplierId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "quote_one_approved_key" ON "production"."quote"("itemSupplierId") WHERE ("approved" = true);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_productionId_supplierId_orderGroup_key" ON "production"."purchase_order"("productionId", "supplierId", "orderGroup");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_installment_purchaseOrderId_number_key" ON "production"."purchase_order_installment"("purchaseOrderId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "tax_one_default_key" ON "production"."tax"("isDefault") WHERE ("isDefault" = true);

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "production"."history"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "project_number_key" ON "projects"."project"("number");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "projects"."project"("clientId");

-- CreateIndex
CREATE INDEX "project_situation_idx" ON "projects"."project"("situation");

-- CreateIndex
CREATE UNIQUE INDEX "project_client_default_key" ON "projects"."project"("clientId") WHERE ("isClientDefault" = true);

-- CreateIndex
CREATE INDEX "project_member_userId_idx" ON "projects"."project_member"("userId");

-- CreateIndex
CREATE INDEX "job_responsibleId_situation_idx" ON "projects"."job"("responsibleId", "situation");

-- CreateIndex
CREATE INDEX "job_clientId_idx" ON "projects"."job"("clientId");

-- CreateIndex
CREATE INDEX "job_deadline_idx" ON "projects"."job"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "job_projectId_sequence_key" ON "projects"."job"("projectId", "sequence");

-- CreateIndex
CREATE INDEX "job_member_userId_idx" ON "projects"."job_member"("userId");

-- CreateIndex
CREATE INDEX "task_jobId_idx" ON "projects"."task"("jobId");

-- CreateIndex
CREATE INDEX "task_responsibleId_situation_idx" ON "projects"."task"("responsibleId", "situation");

-- CreateIndex
CREATE INDEX "briefing_version_jobId_idx" ON "projects"."briefing_version"("jobId");

-- CreateIndex
CREATE INDEX "status_docType_active_idx" ON "projects"."status"("docType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "status_group_name_key" ON "projects"."status_group"("name");

-- CreateIndex
CREATE INDEX "comment_docType_docId_idx" ON "projects"."comment"("docType", "docId");

-- CreateIndex
CREATE INDEX "approval_request_docType_docId_idx" ON "projects"."approval_request"("docType", "docId");

-- CreateIndex
CREATE INDEX "approval_request_fileId_idx" ON "projects"."approval_request"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_vote_requestId_userId_key" ON "projects"."approval_vote"("requestId", "userId");

-- CreateIndex
CREATE INDEX "approval_marker_requestId_idx" ON "projects"."approval_marker"("requestId");

-- CreateIndex
CREATE INDEX "history_entityType_entityId_idx" ON "projects"."history"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "time_entry_userId_startedAt_idx" ON "timesheet"."time_entry"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "time_entry_docType_docId_idx" ON "timesheet"."time_entry"("docType", "docId");

-- CreateIndex
CREATE INDEX "time_entry_clientId_startedAt_idx" ON "timesheet"."time_entry"("clientId", "startedAt");

-- CreateIndex
CREATE INDEX "time_entry_projectId_idx" ON "timesheet"."time_entry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "time_entry_one_running_key" ON "timesheet"."time_entry"("userId") WHERE (situation = 'RUNNING');

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_one_default_key" ON "timesheet"."work_schedule"("isDefault") WHERE ("isDefault" = true);

-- CreateIndex
CREATE UNIQUE INDEX "user_schedule_userId_validFrom_key" ON "timesheet"."user_schedule"("userId", "validFrom");

-- AddForeignKey
ALTER TABLE "access"."user_account" ADD CONSTRAINT "user_account_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "access"."access_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."user_account" ADD CONSTRAINT "user_account_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "access"."collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."collaborator" ADD CONSTRAINT "collaborator_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "access"."position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "access"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "access"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "access"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."party" ADD CONSTRAINT "party_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "crm"."client_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."contact" ADD CONSTRAINT "contact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "crm"."party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."contact" ADD CONSTRAINT "contact_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "crm"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."party_note" ADD CONSTRAINT "party_note_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "crm"."party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill" ADD CONSTRAINT "bill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill" ADD CONSTRAINT "bill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance"."account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill" ADD CONSTRAINT "bill_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "finance"."payment_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill" ADD CONSTRAINT "bill_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "finance"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill_cost_center" ADD CONSTRAINT "bill_cost_center_billId_fkey" FOREIGN KEY ("billId") REFERENCES "finance"."bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill_cost_center" ADD CONSTRAINT "bill_cost_center_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "finance"."cost_center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill_adjustment" ADD CONSTRAINT "bill_adjustment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "finance"."bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bill_adjustment" ADD CONSTRAINT "bill_adjustment_adjustmentTypeId_fkey" FOREIGN KEY ("adjustmentTypeId") REFERENCES "finance"."adjustment_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."transfer" ADD CONSTRAINT "transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "finance"."account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."transfer" ADD CONSTRAINT "transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "finance"."account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "finance"."category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media" ADD CONSTRAINT "media_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "media"."network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media" ADD CONSTRAINT "media_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "media"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_member" ADD CONSTRAINT "media_member_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"."media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_piece" ADD CONSTRAINT "media_piece_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"."media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_grid" ADD CONSTRAINT "media_grid_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"."media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_grid" ADD CONSTRAINT "media_grid_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "media"."market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_line" ADD CONSTRAINT "media_line_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "media"."media_grid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_line" ADD CONSTRAINT "media_line_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "media"."media_piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_line" ADD CONSTRAINT "media_line_programId_fkey" FOREIGN KEY ("programId") REFERENCES "media"."program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_line" ADD CONSTRAINT "media_line_costMetricId_fkey" FOREIGN KEY ("costMetricId") REFERENCES "media"."cost_metric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."media_installment" ADD CONSTRAINT "media_installment_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"."media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."program" ADD CONSTRAINT "program_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "media"."network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."price_table" ADD CONSTRAINT "price_table_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "media"."network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."price_table" ADD CONSTRAINT "price_table_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "media"."market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."price_table_row" ADD CONSTRAINT "price_table_row_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "media"."price_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."price_table_row" ADD CONSTRAINT "price_table_row_programId_fkey" FOREIGN KEY ("programId") REFERENCES "media"."program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production" ADD CONSTRAINT "production_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "production"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production" ADD CONSTRAINT "production_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "production"."tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_member" ADD CONSTRAINT "production_member_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "production"."production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."item" ADD CONSTRAINT "item_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "production"."production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."item_supplier" ADD CONSTRAINT "item_supplier_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "production"."item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."quote" ADD CONSTRAINT "quote_itemSupplierId_fkey" FOREIGN KEY ("itemSupplierId") REFERENCES "production"."item_supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."purchase_order" ADD CONSTRAINT "purchase_order_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "production"."production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."purchase_order_installment" ADD CONSTRAINT "purchase_order_installment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "production"."purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project" ADD CONSTRAINT "project_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "projects"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_member" ADD CONSTRAINT "project_member_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_favorite" ADD CONSTRAINT "project_favorite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."job" ADD CONSTRAINT "job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."job" ADD CONSTRAINT "job_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "projects"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."job_member" ADD CONSTRAINT "job_member_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "projects"."job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."task" ADD CONSTRAINT "task_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "projects"."job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."task" ADD CONSTRAINT "task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "projects"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."task_dependency" ADD CONSTRAINT "task_dependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "projects"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."task_dependency" ADD CONSTRAINT "task_dependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "projects"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."briefing_version" ADD CONSTRAINT "briefing_version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "projects"."job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."status" ADD CONSTRAINT "status_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "projects"."status_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."comment" ADD CONSTRAINT "comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "projects"."comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."approval_vote" ADD CONSTRAINT "approval_vote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "projects"."approval_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."approval_marker" ADD CONSTRAINT "approval_marker_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "projects"."approval_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."template_job" ADD CONSTRAINT "template_job_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "projects"."project_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."template_task" ADD CONSTRAINT "template_task_templateJobId_fkey" FOREIGN KEY ("templateJobId") REFERENCES "projects"."template_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet"."user_schedule" ADD CONSTRAINT "user_schedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "timesheet"."work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== 20261014120000_media_line_discount =====
-- AlterTable
ALTER TABLE "media"."media_line" DROP COLUMN "discountPercent",
ADD COLUMN     "discountType" "media"."ValueType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "discountValue" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- ===== Registro das migrações (o Prisma não as roda de novo) =====
CREATE TABLE "public"."_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "public"."_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count") VALUES
(gen_random_uuid()::text, 'a450978ed65782468ee5c7063e4ca3337653e868d9e7c330dca93056a1c6a1ea', now(), '20261013000000_init', now(), 1),
(gen_random_uuid()::text, '86b82516055a42e9bcac1e096cd8a0074425ca1104b5f09ecf3efbd8e3b69ceb', now(), '20261014120000_media_line_discount', now(), 1);

COMMIT;
