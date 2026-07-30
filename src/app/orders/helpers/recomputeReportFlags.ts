import {Prisma} from "@prisma/client";
import {prisma} from "../../../database/db";

// structural type: anything with $executeRaw works (prisma, tx, extended clients)
type RawExecutor = {
  $executeRaw: (
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ) => Promise<number>;
};

export const recomputeReportFlags = async (
  where: Prisma.Sql,
  client: RawExecutor = prisma,
) => {
  return client.$executeRaw`
    UPDATE "Order" o SET
      "hasMainReceivedReport" = EXISTS (
        SELECT 1 FROM "_BranchReportToOrder" bro
        JOIN "BranchReport" br ON br."id" = bro."A"
        JOIN "Report" r        ON r."id"  = br."id"
        WHERE bro."B" = o."id" AND r."deleted" = false
          AND br."type" = 'received' AND br."forChildBranches" = false
      ),
      "hasMainForwardedReport" = EXISTS (
        SELECT 1 FROM "_BranchReportToOrder" bro
        JOIN "BranchReport" br ON br."id" = bro."A"
        JOIN "Report" r        ON r."id"  = br."id"
        WHERE bro."B" = o."id" AND r."deleted" = false
          AND br."type" = 'forwarded' AND br."forChildBranches" = false
      ),
      "hasChildReceivedReport" = EXISTS (
        SELECT 1 FROM "_BranchReportToOrder" bro
        JOIN "BranchReport" br ON br."id" = bro."A"
        JOIN "Report" r        ON r."id"  = br."id"
        WHERE bro."B" = o."id" AND r."deleted" = false
          AND br."type" = 'received' AND br."forChildBranches" = true
      ),
      "hasChildForwardedReport" = EXISTS (
        SELECT 1 FROM "_BranchReportToOrder" bro
        JOIN "BranchReport" br ON br."id" = bro."A"
        JOIN "Report" r        ON r."id"  = br."id"
        WHERE bro."B" = o."id" AND r."deleted" = false
          AND br."type" = 'forwarded' AND br."forChildBranches" = true
      ),
      "hasDeliveredClientReport" = EXISTS (
        SELECT 1 FROM "_ClientReportToOrder" cro
        JOIN "ClientReport" cr ON cr."id" = cro."A"
        JOIN "Report" r        ON r."id"  = cr."id"
        WHERE cro."B" = o."id" AND r."deleted" = false
          AND cr."secondaryType" = 'DELIVERED'
      ),
      "hasReturnedClientReport" = EXISTS (
        SELECT 1 FROM "_ClientReportToOrder" cro
        JOIN "ClientReport" cr ON cr."id" = cro."A"
        JOIN "Report" r        ON r."id"  = cr."id"
        WHERE cro."B" = o."id" AND r."deleted" = false
          AND cr."secondaryType" = 'RETURNED'
      )
    WHERE ${where};
  `;
};
