-- CreateTable
CREATE TABLE "tema_progreso" (
    "user_id" UUID NOT NULL,
    "tema" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "racha" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tema_progreso_pkey" PRIMARY KEY ("user_id","tema")
);

-- CreateIndex
CREATE INDEX "tema_progreso_user_id_updated_at_idx" ON "tema_progreso"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "tema_progreso" ADD CONSTRAINT "tema_progreso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
