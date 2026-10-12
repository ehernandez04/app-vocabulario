-- CreateTable
CREATE TABLE "lists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_words" (
    "list_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,

    CONSTRAINT "list_words_pkey" PRIMARY KEY ("list_id","word_id")
);

-- CreateIndex
CREATE INDEX "lists_user_id_updated_at_idx" ON "lists"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "list_words_word_id_idx" ON "list_words"("word_id");

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "list_words" ADD CONSTRAINT "list_words_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "list_words" ADD CONSTRAINT "list_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
