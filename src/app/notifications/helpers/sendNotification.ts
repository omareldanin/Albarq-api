import admin from "firebase-admin";
import {env} from "../../../config";
import {Logger} from "../../../lib/logger";
import type {NotificationCreateType} from "../notifications.dto";
import {NotificationsRepository} from "../notifications.repository";
import {prisma} from "../../../database/db";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  }),
});

const notificationsRepository = new NotificationsRepository();

export const sendNotification = async (data: NotificationCreateType) => {
  try {
    let createdNotification: {
      id: number;
      title: string;
      content: string;
      seen: boolean;
      createdAt: Date;
      orderId: string | null;
      user: {
        id: number;
        fcm: string;
      };
    } | null = null;

    if (!data.content.includes("رساله")) {
      createdNotification =
        await notificationsRepository.createNotification(data);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: data.userID,
      },
      select: {
        fcm: true,
      },
    });

    if (!user?.fcm) {
      return;
    }
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: user.fcm,
        sound: "default",
        title: data.title,
        body: data.content,
        data: {
          message: data.forChat ? "true" : "false",
          orderId: data.orderId || null,
          chatId: data.chatId || null,
          receiptNumber: data.receiptNumber || null,
          userId: data.userID || null,
          notificationId: createdNotification ? createdNotification.id : null,
        },
      }),
    });
    // Expo answers 200 with a ticket; a failed send (e.g. InvalidCredentials when
    // the Android app has no FCM V1 key on EAS, DeviceNotRegistered) is inside it.
    const result = (await response.json()) as {
      data?: {status?: string; message?: string; details?: {error?: string}};
      errors?: unknown[];
    };
    if (!response.ok || result.errors || result.data?.status === "error") {
      Logger.error(
        `Expo push failed for user ${data.userID}: ${JSON.stringify(result.errors ?? result.data)}`,
      );
    }
  } catch (error) {
    Logger.error("Error sending message to token:", error);
  }
};
