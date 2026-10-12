-- CreateTable
CREATE TABLE "push_subs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "hour" VARCHAR(5) NOT NULL,
    "tz" TEXT NOT NULL,
    "last_sent_day" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subs_endpoint_key" ON "push_subs"("endpoint");

-- CreateIndex
CREATE INDEX "push_subs_user_id_idx" ON "push_subs"("user_id");

-- AddForeignKey
ALTER TABLE "push_subs" ADD CONSTRAINT "push_subs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
