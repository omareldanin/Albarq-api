import app from "./app";
import { env } from "./config";
import { automaticUpdatesCronJob } from "./cron-jobs/automaticUpdatesCronJob";
import { Logger } from "./lib/logger";


const address = `http://localhost:${env.PORT}`;
import { Server } from "socket.io";
import http from "http";
import { MessagesController } from "./app/messages/messages.controller";
const newServer = http.createServer(app);

const messageController=new MessagesController()
// Middlewares
export const io = new Server(newServer, {
    cors: {
      origin: "*", // or whatever port your frontend runs on
      credentials: true
    },
  });

io.on("connection",(socket)=>{
    socket.on("joinChat", async (data) => {
        socket.join(`chat_${data.orderId}`);
        const initialMessages=await messageController.getChatMessages(data.orderId,data.userId)
        socket.join(`${data.userId}`);
        socket.emit("chatMessages",initialMessages)
        console.log(`Socket ${socket.id} joined room chat_${data.orderId}`);
    });
    socket.on("saveUserId",(id)=>{
        socket.join(`${id}`);
    })
    // Leave room
    socket.on("leaveChat", (orderId) => {
        socket.leave(`chat_${orderId}`);
    });

    socket.on("disconnect", () => {
        console.log("🔥 Client disconnected:", socket.id);
    });
})

const server = newServer.listen(env.PORT, () => {
    console.info(
        "------------------------------------------------------------------------------------------\n"
    );
    Logger.debug(`Starting APP On -> ${address}`);
    automaticUpdatesCronJob.start();
});

process.on("uncaughtException", (err) => {
    // console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    // console.log(err.name, "\n", err.message);
    Logger.error("💥 UNCAUGHT EXCEPTION! 💥 Shutting down... 💥");
    Logger.error(`${err.name}\n${err.message}`);
    process.exit(1);
});

process.on("unhandledRejection", (err: Error) => {
    // console.log("UNHANDLED REJECTION! 💥 Shutting down...");
    // console.log(err.name, err.message);
    Logger.error("💥 UNHANDLED REJECTION! 💥 Shutting down... 💥");
    Logger.error(`${err.name}\n${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});
