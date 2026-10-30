-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_barcode_key" ON "StockItem"("barcode");
