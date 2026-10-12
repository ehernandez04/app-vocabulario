-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_day" VARCHAR(10),
ADD COLUMN     "streak" INTEGER NOT NULL DEFAULT 0;
