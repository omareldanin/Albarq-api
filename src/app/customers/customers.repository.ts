import type {OrderStatus, Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import type {loggedInUserType} from "../../types/user";
import {phoneVariants} from "./customers.dto";

const DELIVERED: OrderStatus[] = ["DELIVERED", "REPLACED"];
const RETURNED: OrderStatus[] = ["RETURNED", "PARTIALLY_RETURNED"];

const percent = (part: number, total: number) =>
  total ? Math.round((part * 100) / total) : 0;

export class CustomersRepository {
  /**
   * Customer history for a phone number.
   * - stats: every order in the user's company (counts only, no personal data)
   * - lastOrder: name/address from the user's OWN orders only, so a client never
   *   sees details another client entered.
   */
  async lookup(user: loggedInUserType, phone: string) {
    const phones = {hasSome: phoneVariants(phone)};
    const companyScope: Prisma.OrderWhereInput = user.companyID
      ? {companyId: user.companyID}
      : {};

    let ownScope: Prisma.OrderWhereInput;
    if (user.role === "CLIENT") ownScope = {clientId: user.id};
    else if (user.role === "CLIENT_ASSISTANT")
      ownScope = {clientId: user.clientId};
    else ownScope = companyScope; // company staff see the company's orders

    const [byStatus, lastOrder] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        where: {...companyScope, deleted: false, recipientPhones: phones},
        _count: {_all: true},
        _max: {createdAt: true},
      }),
      prisma.order.findFirst({
        where: {...ownScope, deleted: false, recipientPhones: phones},
        orderBy: {createdAt: "desc"},
        select: {
          recipientName: true,
          governorate: true,
          locationId: true,
          location: {select: {name: true}},
          recipientAddress: true,
          createdAt: true,
        },
      }),
    ]);

    let total = 0;
    let delivered = 0;
    let returned = 0;
    let lastOrderAt: Date | null = null;
    for (const row of byStatus) {
      const count = row._count._all;
      total += count;
      if (DELIVERED.includes(row.status)) delivered += count;
      if (RETURNED.includes(row.status)) returned += count;
      const max = row._max.createdAt;
      if (max && (!lastOrderAt || max > lastOrderAt)) lastOrderAt = max;
    }
    const inProgress = total - delivered - returned;

    const name = lastOrder?.recipientName?.trim();
    return {
      phone,
      stats: {
        total,
        delivered,
        returned,
        inProgress,
        deliveredRate: percent(delivered, total),
        returnedRate: percent(returned, total),
        lastOrderAt,
      },
      lastOrder: lastOrder
        ? {
            recipientName: name && name !== "غير معرف" ? name : null,
            governorate: lastOrder.governorate,
            locationID: lastOrder.locationId,
            locationName: lastOrder.location?.name ?? null,
            recipientAddress: lastOrder.recipientAddress || null,
            createdAt: lastOrder.createdAt,
          }
        : null,
    };
  }
}
