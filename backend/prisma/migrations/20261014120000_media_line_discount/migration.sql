-- AlterTable
ALTER TABLE "media"."media_line" DROP COLUMN "discountPercent",
ADD COLUMN     "discountType" "media"."ValueType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "discountValue" DECIMAL(14,4) NOT NULL DEFAULT 0;

