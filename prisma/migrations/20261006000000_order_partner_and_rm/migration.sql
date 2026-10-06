-- AlterTable
ALTER TABLE "User" ADD COLUMN     "relationshipManagerId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "partnerId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_relationshipManagerId_fkey" FOREIGN KEY ("relationshipManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

