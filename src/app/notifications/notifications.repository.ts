import {prisma} from "../../database/db";
import type {
  NotificationCreateType,
  NotificationUpdateType,
} from "./notifications.dto";
import {
  notificationReform,
  notificationSelect,
} from "./notifications.responses";

export class NotificationsRepository {
  async createNotification(data: NotificationCreateType) {
    const createdNotification = await prisma.notification.create({
      data: {
        title: data.title,
        content: data.content,
        receiptNumber: data.orderId ? data.orderId : undefined,
        type: data.type,
        user: {
          connect: {
            id: data.userID,
          },
        },
        // company: {
        //     connect: {
        //         id: companyID
        //     }
        // }
      },
      select: notificationSelect,
    });

    return notificationReform(createdNotification);
  }

  async getAllNotificationsPaginated(
    userID: number,
    page: number,
    size: number,
    seen: boolean,
  ) {
    const paginatedNotifications = await prisma.notification.findManyPaginated(
      {
        where: {
          userId: userID,
          seen: seen ? undefined : false,
        },
        orderBy: {
          id: "desc",
        },
        select: notificationSelect,
      },
      {
        page: page,
        size: size,
        withCount: true,
      },
    );

    const unSeenCount = await prisma.notification.count({
      where: {
        seen: false,
        userId: userID,
      },
    });

    return {
      notifications: paginatedNotifications.data.map(notificationReform),
      pagesCount: paginatedNotifications.pagesCount,
      unSeenCount: unSeenCount,
    };
  }

  async updateNotification(data: {
    notificationID: number;
    notificationData: NotificationUpdateType;
  }) {
    const notification = await prisma.notification.update({
      where: {
        id: data.notificationID,
      },
      data: {
        seen: data.notificationData.seen,
      },
      select: notificationSelect,
    });
    return notificationReform(notification);
  }

  async updateNotifications(data: {
    userID: number;
    notificationData: NotificationUpdateType;
  }) {
    return prisma.notification.updateMany({
      where: {
        userId: data.userID, // ← direct column, no user subquery
        seen: !data.notificationData.seen, // ← see Problem 2
      },
      data: {seen: data.notificationData.seen},
    });
  }
}
