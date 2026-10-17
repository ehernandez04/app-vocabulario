-- CreateTable
CREATE TABLE "tts_usage" (
    "month" VARCHAR(7) NOT NULL,
    "chars" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tts_usage_pkey" PRIMARY KEY ("month")
);
