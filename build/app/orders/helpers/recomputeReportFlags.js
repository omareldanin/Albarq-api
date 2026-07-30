"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeReportFlags = void 0;
const db_1 = require("../../../database/db");
const recomputeReportFlags = async (where, client = db_1.prisma) => {
    return client.$executeRaw `
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
exports.recomputeReportFlags = recomputeReportFlags;
//# sourceMappingURL=recomputeReportFlags.js.map