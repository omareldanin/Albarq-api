-- AlterEnum
ALTER TYPE "SecondaryStatus" ADD VALUE 'WITH_RECEIVING_AGENT';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "receivingAgentId" INTEGER;

-- CreateTable
CREATE TABLE "ReceivingAgentClients" (
    "agentId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,

    CONSTRAINT "ReceivingAgentClients_pkey" PRIMARY KEY ("agentId","clientId")
);

-- AddForeignKey
ALTER TABLE "ReceivingAgentClients" ADD CONSTRAINT "ReceivingAgentClients_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingAgentClients" ADD CONSTRAINT "ReceivingAgentClients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
