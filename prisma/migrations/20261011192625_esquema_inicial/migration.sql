-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "en" TEXT NOT NULL,
    "es" TEXT NOT NULL,
    "ipa" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '📝',
    "xe" TEXT NOT NULL DEFAULT '',
    "xs" TEXT NOT NULL DEFAULT '',
    "svg" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress" (
    "user_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "due" VARCHAR(10) NOT NULL,
    "seen" INTEGER NOT NULL DEFAULT 0,
    "miss" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("user_id","word_id")
);

-- CreateTable
CREATE TABLE "audio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "word_id" UUID NOT NULL,
    "voz" TEXT NOT NULL,
    "parte" VARCHAR(2) NOT NULL,
    "mp3" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "words_user_id_idx" ON "words"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "words_user_id_en_key" ON "words"("user_id", "en");

-- CreateIndex
CREATE INDEX "progress_user_id_due_idx" ON "progress"("user_id", "due");

-- CreateIndex
CREATE UNIQUE INDEX "audio_word_id_voz_parte_key" ON "audio"("word_id", "voz", "parte");

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audio" ADD CONSTRAINT "audio_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
