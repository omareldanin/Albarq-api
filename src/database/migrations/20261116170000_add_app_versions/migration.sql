-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "AppVersion" (
    "id" SERIAL NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "minVersion" TEXT NOT NULL DEFAULT '0.0.0',
    "storeUrl" TEXT NOT NULL,
    "releaseNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_platform_key" ON "AppVersion"("platform");
