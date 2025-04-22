-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('DELIVERY', 'CLIENT');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sendFor" "MessageType";
