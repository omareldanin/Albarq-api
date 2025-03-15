-- CreateTable
CREATE TABLE "CustomerOutput" (
    "id" SERIAL NOT NULL,
    "repositoryId" INTEGER,
    "orderId" INTEGER,

    CONSTRAINT "CustomerOutput_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;
