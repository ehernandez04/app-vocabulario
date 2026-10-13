-- CreateTable
CREATE TABLE "tema_ejercicios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tema" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'elegir',
    "datos" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tema_ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tema_ejercicios_user_id_tema_nivel_idx" ON "tema_ejercicios"("user_id", "tema", "nivel");

-- CreateIndex
CREATE INDEX "tema_ejercicios_user_id_updated_at_idx" ON "tema_ejercicios"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "tema_ejercicios" ADD CONSTRAINT "tema_ejercicios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
