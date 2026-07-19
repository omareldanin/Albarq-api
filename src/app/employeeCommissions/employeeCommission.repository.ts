import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import {loggedInUserType} from "../../types/user";
import {EmployeeClientCommissionUpsertType} from "./employeeCommissions.dto";
import {Prisma} from "@prisma/client";

type CommissionRow = {
  clientId: number;
  clientName: string | null;
  baghdadOrderCost: number;
  govOrderCost: number;
  baghdadCount: bigint;
  govCount: bigint;
  baghdadTotal: number;
  govTotal: number;
};

export class EmployeeClientCommissionRepository {
  getEmployeeClients = async ({employeeID}: {employeeID: number}) => {
    return prisma.employeeClientCommission.findMany({
      where: {employeeId: employeeID},
      include: {
        client: {select: {id: true, user: {select: {name: true}}}},
      },
    });
  };

  upsertEmployeeClient = async ({
    employeeID,
    data,
  }: {
    employeeID: number;
    data: EmployeeClientCommissionUpsertType;
  }) => {
    const {clientID, ...rest} = data;

    // check if this client is already assigned to a different employee
    const existing = await prisma.employeeClientCommission.findUnique({
      where: {clientId: clientID},
      include: {
        employee: {select: {id: true, user: {select: {name: true}}}},
      },
    });

    if (existing && existing.employeeId !== employeeID) {
      throw new AppError(
        `هذا العميل مسند بالفعل للموظف ${existing.employee?.user?.name ?? existing.employeeId}`,
        400,
      );
    }

    return prisma.employeeClientCommission.upsert({
      where: {clientId: clientID},
      update: {employeeId: employeeID, ...rest},
      create: {employeeId: employeeID, clientId: clientID, ...rest},
    });
  };

  calculateEmployeeCommission = async ({
    employeeID,
    startDate,
    endDate,
  }: {
    employeeID: number;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const rows = await prisma.$queryRaw<CommissionRow[]>`
    SELECT
      ecc."clientId",
      u."name"              AS "clientName",
      ecc."baghdadOrderCost",
      ecc."govOrderCost",
      COUNT(o."id") FILTER (WHERE o."governorate" = 'BAGHDAD')  AS "baghdadCount",
      COUNT(o."id") FILTER (WHERE o."governorate" <> 'BAGHDAD') AS "govCount",
      COUNT(o."id") FILTER (WHERE o."governorate" = 'BAGHDAD')  * ecc."baghdadOrderCost" AS "baghdadTotal",
      COUNT(o."id") FILTER (WHERE o."governorate" <> 'BAGHDAD') * ecc."govOrderCost"     AS "govTotal"
    FROM "EmployeeClientCommission" ecc
    LEFT JOIN "Client" c ON c."id" = ecc."clientId"
    LEFT JOIN "User"   u ON u."id" = c."id"
    LEFT JOIN "Order"  o
      ON o."clientId" = ecc."clientId"
     AND o."deleted" = false
     AND o."status" IN ('DELIVERED', 'PARTIALLY_RETURNED', 'REPLACED')
     AND (
       o."employeeReportId" IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "Report" r2
         WHERE r2."id" = o."employeeReportId"
           AND r2."deleted" = false
       )
     )
     AND EXISTS (
       SELECT 1
       FROM "_ClientReportToOrder" cro
       JOIN "ClientReport" cr ON cr."id" = cro."A"
       JOIN "Report" r        ON r."id"  = cr."id"
       WHERE cro."B" = o."id"
         AND cr."secondaryType" = 'DELIVERED'
         AND r."deleted" = false
     )
     ${startDate ? Prisma.sql`AND o."receivedAt" >= ${startDate}` : Prisma.empty}
     ${endDate ? Prisma.sql`AND o."receivedAt" <= ${endDate}` : Prisma.empty}
    WHERE ecc."employeeId" = ${employeeID}
      AND ecc."active" = true
    GROUP BY ecc."clientId", u."name", ecc."baghdadOrderCost", ecc."govOrderCost";
  `;

    const details = rows
      .map((r) => {
        const baghdadCount = Number(r.baghdadCount);
        const govCount = Number(r.govCount);
        const baghdadTotal = Number(r.baghdadTotal);
        const govTotal = Number(r.govTotal);
        return {
          clientId: r.clientId,
          clientName: r.clientName,
          baghdadOrderCost: r.baghdadOrderCost,
          govOrderCost: r.govOrderCost,
          baghdadCount,
          govCount,
          baghdadTotal,
          govTotal,
          deliveredCount: baghdadCount + govCount,
          total: baghdadTotal + govTotal,
        };
      })
      .filter((d) => d.deliveredCount > 0);

    return {
      employeeID,
      details,
      totalBaghdadOrders: details.reduce((sum, d) => sum + d.baghdadCount, 0),
      totalGovOrders: details.reduce((sum, d) => sum + d.govCount, 0),
      totalOrders: details.reduce((sum, d) => sum + d.deliveredCount, 0),
      totalBaghdadCommission: details.reduce(
        (sum, d) => sum + d.baghdadTotal,
        0,
      ),
      totalGovCommission: details.reduce((sum, d) => sum + d.govTotal, 0),
      totalCommission: details.reduce((sum, d) => sum + d.total, 0),
    };
  };

  private getEmployeeOrderIDs = async ({
    employeeID,
    startDate,
    endDate,
  }: {
    employeeID: number;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const rows = await prisma.$queryRaw<{id: string}[]>`
      SELECT o."id"
      FROM "EmployeeClientCommission" ecc
      JOIN "Order" o
        ON o."clientId" = ecc."clientId"
      AND o."deleted" = false
      AND o."status" IN ('DELIVERED', 'PARTIALLY_RETURNED', 'REPLACED')
      AND EXISTS (
        SELECT 1
        FROM "_ClientReportToOrder" cro
        JOIN "ClientReport" cr ON cr."id" = cro."A"
        JOIN "Report" r        ON r."id"  = cr."id"
        WHERE cro."B" = o."id"
          AND cr."secondaryType" = 'DELIVERED'
          AND r."deleted" = false
      )
      AND (
        o."employeeReportId" IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM "Report" r2
          WHERE r2."id" = o."employeeReportId"
            AND r2."deleted" = false
        )
      )
      ${startDate ? Prisma.sql`AND o."receivedAt" >= ${startDate}` : Prisma.empty}
      ${endDate ? Prisma.sql`AND o."receivedAt" <= ${endDate}` : Prisma.empty}
      WHERE ecc."employeeId" = ${employeeID}
        AND ecc."active" = true;
    `;

    return rows.map((r) => r.id);
  };

  createReport = async ({
    employeeID,
    startDate,
    endDate,
    loggedInUser,
  }: {
    employeeID: number;
    startDate?: Date;
    endDate?: Date;
    loggedInUser: loggedInUserType;
  }) => {
    const data = await this.calculateEmployeeCommission({
      employeeID,
      startDate,
      endDate,
    });

    const orderIDs = await this.getEmployeeOrderIDs({
      employeeID,
      startDate,
      endDate,
    });

    const createdReport = await prisma.employeeReport.create({
      data: {
        employee: {
          connect: {
            id: employeeID,
          },
        },
        orders: {
          connect: orderIDs.map((id) => ({id})),
        },
        report: {
          create: {
            type: "EMPLOYEE",
            createdBy: {
              connect: {
                id: loggedInUser.id,
              },
            },
            company: {
              connect: {
                id: loggedInUser.companyID as number,
              },
            },
            baghdadOrdersCount: data.totalBaghdadOrders,
            governoratesOrdersCount: data.totalGovOrders,
            totalCost: 0,
            paidAmount: 0,
            deliveryCost: 0,
            clientNet: 0,
            deliveryAgentNet: data.totalCommission,
            companyNet: 0,
            branchNet: 0,
          },
        },
      },
    });

    return {
      id: createdReport.id,
      data,
    };
  };

  deleteEmployeeClient = async ({
    employeeID,
    clientID,
  }: {
    employeeID: number;
    clientID: number;
  }) => {
    return prisma.employeeClientCommission.delete({
      where: {
        employeeId_clientId: {employeeId: employeeID, clientId: clientID},
      },
    });
  };
}
