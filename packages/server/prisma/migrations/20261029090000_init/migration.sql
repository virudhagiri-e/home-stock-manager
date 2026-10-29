-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FAMILY');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('GROCERY', 'MEDICINE', 'HOUSEHOLD', 'OTHER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('COUNT', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'TABLET', 'STRIP', 'BOTTLE', 'PACKET');

-- CreateEnum
CREATE TYPE "MedicineFor" AS ENUM ('ME', 'WIFE', 'BOTH', 'CHILD', 'FAMILY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FAMILY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "unit" "Unit" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "medicineFor" "MedicineFor",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEvent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "afterValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "StockItem_category_idx" ON "StockItem"("category");

-- CreateIndex
CREATE INDEX "StockItem_quantity_threshold_idx" ON "StockItem"("quantity", "threshold");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_name_category_key" ON "StockItem"("name", "category");

-- CreateIndex
CREATE INDEX "StockEvent_itemId_createdAt_idx" ON "StockEvent"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
