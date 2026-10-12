-- AlterTable
ALTER TABLE "words" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "progress_user_id_updated_at_idx" ON "progress"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "words_user_id_updated_at_idx" ON "words"("user_id", "updated_at");
