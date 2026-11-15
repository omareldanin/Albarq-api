import type {Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import {Logger} from "../../lib/logger";
import {io} from "../../server";
import type {loggedInUserType} from "../../types/user";
import {MessagesController} from "../messages/messages.controller";
import {sendNotification} from "../notifications/helpers/sendNotification";
import {OrdersRepository} from "../orders/orders.repository";
import {
  type ClientProcessingAction,
  type ClientProcessingListType,
  type ClientProcessOrderType,
  clientProcessingActions,
} from "./clientProcessing.dto";

const ordersRepository = new OrdersRepository();
const messagesController = new MessagesController();

const processingOrderSelect = {
  id: true,
  receiptNumber: true,
  recipientName: true,
  recipientPhones: true,
  recipientAddress: true,
  governorate: true,
  totalCost: true,
  notes: true,
  clientNotes: true,
  processingStatus: true,
  updatedAt: true,
  location: {select: {name: true}},
  store: {select: {name: true}},
} satisfies Prisma.OrderSelect;

/** What the timeline entry of a client processing stores in its `new` field. */
export type ClientProcessingEntry = {
  source: "CLIENT";
  action: ClientProcessingAction;
  label: string;
  note: string | null;
  phone: string | null;
};

const toEnglishDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const parseEntry = (value: Prisma.JsonValue): ClientProcessingEntry | null => {
  try {
    // Timeline JSON is stored as a string, like the rest of the order timeline.
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed &&
      typeof parsed === "object" &&
      (parsed as {source?: string}).source === "CLIENT"
      ? (parsed as ClientProcessingEntry)
      : null;
  } catch {
    return null;
  }
};

export class ClientProcessingRepository {
  private clientID(user: loggedInUserType) {
    if (user.role !== "CLIENT" || !Number.isInteger(user.id) || user.id <= 0) {
      throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
    }
    return user.id;
  }

  /** The client's orders in PROCESSING, split into not processed yet / processed. */
  getOrders = async (
    user: loggedInUserType,
    filters: ClientProcessingListType,
  ) => {
    const clientId = this.clientID(user);
    const base = {
      clientId,
      deleted: false,
      status: "PROCESSING",
    } satisfies Prisma.OrderWhereInput;
    const pendingWhere = {
      ...base,
      processingStatus: "not_processed",
    } satisfies Prisma.OrderWhereInput;
    const processedWhere = {
      ...base,
      processingStatus: {in: ["processed", "confirmed"]},
    } satisfies Prisma.OrderWhereInput;
    const where = filters.state === "pending" ? pendingWhere : processedWhere;

    const [orders, pending, processed] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: {updatedAt: "desc"},
        skip: (filters.page - 1) * filters.size,
        take: filters.size,
        select: processingOrderSelect,
      }),
      prisma.order.count({where: pendingWhere}),
      prisma.order.count({where: processedWhere}),
    ]);

    // Latest client processing of each processed order, from the order timeline.
    const latest = new Map<
      string,
      {entry: ClientProcessingEntry; date: Date}
    >();
    if (filters.state === "processed" && orders.length > 0) {
      const entries = await prisma.orderTimeline.findMany({
        where: {
          orderId: {in: orders.map((order) => order.id)},
          type: "ORDER_PROCESS",
        },
        orderBy: {createdAt: "desc"},
        select: {orderId: true, new: true, createdAt: true},
      });
      for (const item of entries) {
        const entry = parseEntry(item.new);
        if (entry && !latest.has(item.orderId))
          latest.set(item.orderId, {entry, date: item.createdAt});
      }
    }

    const total = filters.state === "pending" ? pending : processed;
    return {
      page: filters.page,
      pagesCount: Math.max(1, Math.ceil(total / filters.size)),
      data: {
        counts: {pending, processed},
        orders: orders.map((order) => ({
          ...order,
          location: order.location?.name ?? null,
          store: order.store?.name ?? null,
          clientProcessing: latest.get(order.id)
            ? {...latest.get(order.id)?.entry, date: latest.get(order.id)?.date}
            : null,
        })),
      },
    };
  };

  /**
   * Records how the client handled an order in PROCESSING: marks it processed, saves the
   * note (and a new primary phone), and logs it on the order timeline. It only touches these
   * fields, so the shared order update and its side effects are not involved.
   */
  processOrder = async (
    user: loggedInUserType,
    orderID: string,
    data: ClientProcessOrderType,
  ) => {
    const clientId = this.clientID(user);
    const order = await prisma.order.findFirst({
      where: {id: orderID, clientId, deleted: false},
      select: {
        id: true,
        receiptNumber: true,
        status: true,
        recipientPhones: true,
        deliveryAgentId: true,
      },
    });
    if (!order) throw new AppError("الطلب غير موجود", 404);
    if (order.status !== "PROCESSING") {
      throw new AppError("يمكن معالجة الطلبات قيد المعالجة فقط", 400);
    }

    let phone: string | null = null;
    if (data.action === "CHANGE_PHONE") {
      phone = toEnglishDigits(data.phone ?? "").replace(/[^0-9]/g, "");
      if (!/^07\d{9}$/.test(phone))
        throw new AppError(
          "رقم الهاتف غير صحيح، يجب أن يبدأ بـ 07 ويتكون من 11 رقم",
          400,
        );
    }
    const note = data.note || null;
    const label = clientProcessingActions[data.action];
    const message = [
      data.action === "OTHER" ? note : label,
      data.action !== "OTHER" ? note : null,
      phone ? `الرقم الجديد: ${phone}` : null,
    ]
      .filter(Boolean)
      .join(" - ");
    const entry: ClientProcessingEntry = {
      source: "CLIENT",
      action: data.action,
      label,
      note,
      phone,
    };
    // The new number becomes the first phone; the other numbers are kept after it.
    const phones = phone
      ? [
          phone,
          ...order.recipientPhones.slice(1).filter((item) => item !== phone),
        ]
      : undefined;

    const date = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {id: order.id, clientId, deleted: false, status: "PROCESSING"},
        data: {
          processingStatus: "processed",
          clientNotes: message,
          recipientPhones: phones,
        },
      });
      if (updated.count === 0) {
        throw new AppError("تغيرت حالة الطلب، حدّث الصفحة وأعد المحاولة", 409);
      }
      await tx.orderTimeline.create({
        data: {
          orderId: order.id,
          type: "ORDER_PROCESS",
          by: {id: user.id, name: user.name, role: user.role},
          old: phone
            ? JSON.stringify({phone: order.recipientPhones[0] ?? null})
            : undefined,
          new: JSON.stringify(entry),
          message: `معالجة من العميل: ${message}`,
          createdAt: date,
        },
      });
    });

    void this.notify(order, message);
    return {
      orderID: order.id,
      processingStatus: "processed" as const,
      clientNotes: message,
      recipientPhones: phones ?? order.recipientPhones,
      clientProcessing: {...entry, date},
    };
  };

  /** Best effort: tell the delivery agent and inquiry employees, and refresh open screens. */
  private notify = async (
    order: {id: string; receiptNumber: string; deliveryAgentId: number | null},
    message: string,
  ) => {
    try {
      const title = `تمت معالجة الطلب رقم ${order.receiptNumber} من قبل العميل - ${message}`;
      const employees =
        await ordersRepository.getOrderInquiryEmployeesForNotifications({
          orderID: order.id,
        });
      const recipients = new Set<number>(
        employees
          .map((employee) => employee.id)
          .filter((id): id is number => typeof id === "number"),
      );
      if (order.deliveryAgentId) recipients.add(order.deliveryAgentId);
      await Promise.all(
        [...recipients].map((userID) =>
          sendNotification({
            orderId: order.id,
            userID,
            title,
            content: "",
            type: "PROCESSING",
          }),
        ),
      );
      const members = await messagesController.getOrderChatMembers(order.id);
      for (const member of members)
        io.to(`${member}`).emit("newUpdate", {id: order.id});
    } catch (error) {
      Logger.error(error);
    }
  };
}
