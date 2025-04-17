import { Router } from "express";

import {  ClientRole, EmployeeRole } from "@prisma/client";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { MessagesController } from "./messages.controller";
const router = Router();

const messageController=new MessagesController()


router.route("/send-message").post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER,
        EmployeeRole.BRANCH_MANAGER,
        EmployeeRole.ACCOUNT_MANAGER,
        EmployeeRole.DATA_ENTRY,
        EmployeeRole.INQUIRY_EMPLOYEE,
        EmployeeRole.DELIVERY_AGENT,
        EmployeeRole.CLIENT_ASSISTANT,
        ClientRole.CLIENT
    ]),
    messageController.sendMessage
);

router.route("/chats").get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER,
        EmployeeRole.BRANCH_MANAGER,
        EmployeeRole.ACCOUNT_MANAGER,
        EmployeeRole.DATA_ENTRY,
        EmployeeRole.INQUIRY_EMPLOYEE,
        EmployeeRole.DELIVERY_AGENT,
        EmployeeRole.CLIENT_ASSISTANT,
        ClientRole.CLIENT
    ]),
    messageController.getUserChatStatics
);
export default router
