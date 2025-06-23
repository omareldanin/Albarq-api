import admin from "firebase-admin";
import { env } from "../../../config";
import { Logger } from "../../../lib/logger";
import type { NotificationCreateType } from "../notifications.dto";
import { NotificationsRepository } from "../notifications.repository";

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
    const createdNotification =
      await notificationsRepository.createNotification(data);
    const user = createdNotification?.user;

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
      }),
    });

    const responseData = await response.json();
    console.log("✅ Push response:", responseData);
  } catch (error) {
    Logger.error("Error sending message to token:", error);
  }
};
