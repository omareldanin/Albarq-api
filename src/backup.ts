import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as cron from "node-cron";
import { google } from "googleapis";
import { env } from "./config";
import { Logger } from "./lib/logger";

// 🔧 CONFIG
const BACKUP_DIR = path.resolve(__dirname, "../backups");
const CREDENTIALS_PATH = path.resolve(__dirname, "../credentials.json");
const GDRIVE_FOLDER_ID = "19-VriVzLqpCDSTPvIA0qYBtZZJGW2odB"; // Optional

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

// ⏰ Run every day at 12:00 AM
export const automaticBackUpCronJob = cron.schedule("* * * * *", async () => {
  Logger.info("Running backup updates");
  //   const date = new Date().toISOString().split("T")[0];
  const fileName = `albarq-backup.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const dumpCommand = `PGPASSWORD=${env.DB_PASSWORD} pg_dump -h albarq-db-do-user-16243774-0.c.db.ondigitalocean.com -p 25060 -U ${env.DB_USER} -F p -d ${env.DB_NAME} -f "${filePath}"`;

  exec(dumpCommand, { env: { ...process.env } }, async (error) => {
    if (error) {
      console.error("Backup failed:", error.message);
      return;
    }
    console.log(`✅ Backup saved to ${filePath}`);
    await uploadToDrive(filePath, fileName);
  });
});

async function uploadToDrive(filePath: string, fileName: string) {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const fileMetadata: any = {
    name: fileName,
    ...(GDRIVE_FOLDER_ID && { parents: [GDRIVE_FOLDER_ID] }),
  };

  const media = {
    mimeType: "application/sql",
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id",
    });
    console.log("✅ Uploaded to Drive. File ID:", response.data.id);
  } catch (err) {
    console.error("❌ Google Drive upload failed:", err);
  }
}
