import type {Prisma} from "@prisma/client";

export const notificationSelect = {
  id: true,
  title: true,
  content: true,
  seen: true,
  createdAt: true,
  receiptNumber: true,
  type: true,
  user: {
    select: {
      id: true,
      fcm: true,
    },
  },
} satisfies Prisma.NotificationSelect;

export const notificationReform = (
  notification: Prisma.NotificationGetPayload<{
    select: typeof notificationSelect;
  }>,
) => {
  if (!notification) {
    return null;
  }
  return {
    id: notification.id,
    title: notification.title,
    content: notification.content,
    seen: notification.seen,
    type: notification.type,
    createdAt: notification.createdAt,
    orderId: notification.receiptNumber,
    user: {
      id: notification.user.id,
      fcm: notification.user.fcm,
    },
  };
};
