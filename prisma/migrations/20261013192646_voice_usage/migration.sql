-- CreateTable
CREATE TABLE "voice_usage" (
    "user_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voice_usage_pkey" PRIMARY KEY ("user_id","day")
);

-- AddForeignKey
ALTER TABLE "voice_usage" ADD CONSTRAINT "voice_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
