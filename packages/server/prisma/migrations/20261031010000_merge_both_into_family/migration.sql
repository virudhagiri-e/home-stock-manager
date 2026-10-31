-- "Both of us" medicines now belong to the whole family; move them before removing the value.
UPDATE "StockItem" SET "medicineFor" = 'FAMILY' WHERE "medicineFor" = 'BOTH';

ALTER TYPE "MedicineFor" RENAME TO "MedicineFor_old";
CREATE TYPE "MedicineFor" AS ENUM ('ME', 'WIFE', 'CHILD', 'FAMILY');
ALTER TABLE "StockItem"
  ALTER COLUMN "medicineFor" TYPE "MedicineFor" USING ("medicineFor"::text::"MedicineFor");
DROP TYPE "MedicineFor_old";
