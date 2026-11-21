import {AdminRole, ClientRole, EmployeeRole} from "@prisma/client";
import * as bcrypt from "bcrypt";
import {env} from "../../config";
import {AppError} from "../../lib/AppError";
import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
// import { BranchesRepository } from "../branches/branches.repository";
import {EmployeesRepository} from "../employees/employees.repository";
import {sendNotification} from "../notifications/helpers/sendNotification";
import {
  ClientCreateSchema,
  ClientUpdateSchema,
  ClientWebhookSettingsSchema,
} from "./clients.dto";
import {
  checkWebhookUrl,
  postClientWebhook,
  type StatusMapping,
} from "../../lib/clientWebhook";
import {ClientsRepository} from "./clients.repository";
import {ClientListFilterSchema} from "./clients.filters";
import crypto from "crypto";
import {prisma} from "../../database/db";
import {z} from "zod";

const clientsRepository = new ClientsRepository();
const employeesRepository = new EmployeesRepository();
// const branchesRepository = new BranchesRepository();

/** Creates a new raw API key, stores only its hash, and returns the raw key once. */
const issueClientApiKey = async (clientId: number) => {
  const rawApiKey = `albarq_live_${crypto.randomBytes(32).toString("hex")}`;
  const apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
  await prisma.client.update({
    where: {id: clientId},
    data: {apiKeyHash},
  });
  return rawApiKey;
};

export class ClientsController {
  createClient = catchAsync(async (req, res) => {
    const clientData = ClientCreateSchema.parse(req.body);
    let companyID = +res.locals.user.companyID;
    const {password, ...rest} = clientData;

    let avatar: string | undefined;
    if (req.file) {
      const file = req.file as Express.MulterS3.File;
      avatar = file.location;
    }

    const currentUser = res.locals.user;
    // TODO: CANT CRATE ADMIN_ASSISTANT

    if (
      !companyID &&
      (currentUser.role === AdminRole.ADMIN ||
        currentUser.role === AdminRole.ADMIN_ASSISTANT)
    ) {
      companyID = clientData.companyID as number;
    }

    // hash the password
    const hashedPassword = bcrypt.hashSync(
      password + (env.PASSWORD_SALT as string),
      12,
    );

    // Optional: link the new client to a receiving agent of the same company.
    const receivingAgentID =
      req.body.receivingAgentID !== undefined &&
      req.body.receivingAgentID !== null &&
      req.body.receivingAgentID !== ""
        ? z.coerce.number().int().positive().parse(req.body.receivingAgentID)
        : undefined;

    if (receivingAgentID) {
      const receivingAgent = await prisma.employee.findFirst({
        where: {
          id: receivingAgentID,
          role: EmployeeRole.RECEIVING_AGENT,
          companyId: companyID,
          deleted: false,
        },
        select: {id: true},
      });
      if (!receivingAgent) {
        throw new AppError("مندوب الاستلام المحدد غير موجود", 400);
      }
    }

    const createdClient = await clientsRepository.createClient(
      companyID,
      {
        ...rest,
        password: hashedPassword,
        userID: currentUser.id,
        avatar,
      },
      {receivingAgentID},
    );

    res.status(200).json({
      status: "success",
      data: createdClient,
    });
  });

  generateApikey = catchAsync(async (req, res) => {
    const {id} = req.body;
    const loggedInUser = res.locals.user as loggedInUserType;

    if (!id) {
      throw new AppError("Client name and permissions are required", 400);
    }

    const client = await clientsRepository.getClient({
      clientID: id,
    });

    if (!client) {
      throw new AppError("Client not found", 404);
    }

    // Company managers may only issue keys for their own company's clients.
    const isAdmin =
      loggedInUser.role === AdminRole.ADMIN ||
      loggedInUser.role === AdminRole.ADMIN_ASSISTANT;
    if (!isAdmin && client.company?.id !== loggedInUser.companyID) {
      throw new AppError("Client not found", 404);
    }

    const rawApiKey = await issueClientApiKey(client.id);

    res.status(200).json({
      status: "success",
      apiKey: rawApiKey,
    });
  });

  // ---- Self-service API key for the logged-in client (developers page) ----

  getMyApiKeyStatus = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {apiKeyHash: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: {hasKey: !!client.apiKeyHash},
    });
  });

  generateMyApiKey = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {id: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    // Replaces any previous key: the old one stops working immediately.
    const rawApiKey = await issueClientApiKey(client.id);
    res.status(200).json({
      status: "success",
      apiKey: rawApiKey,
    });
  });

  revokeMyApiKey = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {id: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    await prisma.client.update({
      where: {id: client.id},
      data: {apiKeyHash: null},
    });
    res.status(200).json({status: "success"});
  });

  // ---- Webhook settings of the logged-in client (developers page) ----

  getMyWebhook = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {webhookUrl: true, token: true, status: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: {
        webhookUrl: client.webhookUrl,
        // The secret itself is never sent back, only whether one is saved.
        hasSecret: !!client.token,
        statuses: (client.status as unknown as StatusMapping[]) ?? [],
      },
    });
  });

  updateMyWebhook = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const settings = ClientWebhookSettingsSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {id: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }

    const webhookUrl = settings.webhookUrl ? settings.webhookUrl : null;
    if (webhookUrl) {
      const check = await checkWebhookUrl(webhookUrl);
      if (!check.ok) {
        throw new AppError(check.reason, 400);
      }
    }

    // One value per status; the last one wins.
    const statuses = Object.values(
      Object.fromEntries(settings.statuses.map((item) => [item.internal, item])),
    );

    await prisma.client.update({
      where: {id: client.id},
      data: {
        webhookUrl,
        status: statuses,
        ...(settings.secret !== undefined && {token: settings.secret || ""}),
      },
    });

    const updated = await prisma.client.findUnique({
      where: {id: client.id},
      select: {webhookUrl: true, token: true, status: true},
    });

    res.status(200).json({
      status: "success",
      data: {
        webhookUrl: updated?.webhookUrl ?? null,
        hasSecret: !!updated?.token,
        statuses: (updated?.status as unknown as StatusMapping[]) ?? [],
      },
    });
  });

  testMyWebhook = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const client = await prisma.client.findFirst({
      where: {id: loggedInUser.id, deleted: false},
      select: {webhookUrl: true, token: true, status: true},
    });
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    if (!client.webhookUrl) {
      throw new AppError("احفظ رابط الـ Webhook أولاً", 400);
    }

    const mappings = (client.status as unknown as StatusMapping[]) ?? [];
    const result = await postClientWebhook({
      url: client.webhookUrl,
      token: client.token,
      payload: {
        receiptNumber: "TEST-0001",
        status: mappings[0]?.external ?? "TEST",
        note: "رسالة تجريبية من البرق",
        test: true,
      },
    });

    res.status(200).json({status: "success", data: result});
  });

  getAllClients = catchAsync(async (req, res) => {
    // Filters
    const loggedInUser = res.locals.user as loggedInUserType;
    let companyID: number | undefined;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyID = req.query.company_id ? +req.query.company_id : undefined;
    } else if (loggedInUser.companyID) {
      companyID = loggedInUser.companyID;
    }

    // Show only clients of the same branch as the logged in user
    let branchID: number | undefined = req.query.branch_id
      ? +req.query.branch_id
      : undefined;

    if (
      loggedInUser.role !== EmployeeRole.COMPANY_MANAGER &&
      loggedInUser.role !== AdminRole.ADMIN &&
      loggedInUser.role !== AdminRole.ADMIN_ASSISTANT &&
      !loggedInUser.mainRepository
    ) {
      const employee = await prisma.employee.findUnique({
        where: {
          id: loggedInUser.id,
        },
        select: {
          branch: {
            select: {
              id: true,
              childBranches: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      if (!employee?.branch?.childBranches.some((b) => b.id === branchID)) {
        branchID = employee?.branch?.id;
      }
    }

    const listFilters = ClientListFilterSchema.parse(req.query);
    const phone = req.query.phone as string | undefined;

    const name = req.query.name as string | undefined;

    const deleted = (req.query.deleted as string) || "false";

    const storeID = req.query.store_id ? +req.query.store_id : undefined;

    const minified = req.query.minified
      ? req.query.minified === "true"
      : undefined;

    let size = req.query.size ? +req.query.size : 10;
    if (size > 500 && minified !== true) {
      size = 10;
    }
    let page = 1;
    if (
      req.query.page &&
      !Number.isNaN(+req.query.page) &&
      +req.query.page > 0
    ) {
      page = +req.query.page;
    }

    const {clients, pagesCount} =
      await clientsRepository.getAllClientsPaginated({
        page: page,
        size: size,
        deleted: deleted,
        companyID: companyID,
        minified: minified,
        storeID: storeID,
        branchID: branchID,
        phone: phone,
        name: name,
        loggedInUser,
        ...listFilters,
      });

    res.status(200).json({
      status: "success",
      page: page,
      pagesCount: pagesCount,
      data: clients,
    });
  });

  getClient = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const loggedInUser = res.locals.user as loggedInUserType;

    if (
      loggedInUser.role === ClientRole.CLIENT ||
      loggedInUser.role === EmployeeRole.CLIENT_ASSISTANT
    ) {
      if (clientID !== loggedInUser.id) {
        throw new AppError("غير مصرح لك الاطلاع علي بيانات عميل اخر", 403);
      }
    }

    const client = await clientsRepository.getClient({
      clientID: clientID,
    });

    res.status(200).json({
      status: "success",
      data: client,
    });
  });

  updateClient = catchAsync(async (req, res) => {
    const clientData = ClientUpdateSchema.parse(req.body);
    const clientID = +req.params.clientID;
    // const companyID = +res.locals.user.companyID;

    let avatar: string | undefined;
    if (req.file) {
      const file = req.file as Express.MulterS3.File;
      avatar = file.location;
    }

    const oldClient = await clientsRepository.getClient({
      clientID: clientID,
    });

    const {password, ...rest} = clientData;

    // hash the password
    const hashedPassword = bcrypt.hashSync(
      password + (env.PASSWORD_SALT as string),
      12,
    );

    const updatedClient = await clientsRepository.updateClient({
      clientID: clientID,
      // companyID: companyID,
      clientData: {
        ...rest,
        password: clientData.password ? hashedPassword : undefined,
        avatar,
      },
    });

    // Send notification to the company manager if the client name is updated
    if (clientData.name && oldClient?.name !== updatedClient?.name) {
      // get the company manager id
      const companyManager = await employeesRepository.getCompanyManager({
        companyID: updatedClient?.company.id as number,
      });

      await sendNotification({
        userID: companyManager?.id as number,
        title: "تغيير اسم عميل",
        content: `تم تغيير اسم العميل ${oldClient?.name} إلى ${updatedClient?.name}`,
      });
    }

    res.status(200).json({
      status: "success",
      data: updatedClient,
    });
  });

  deleteClient = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;

    await clientsRepository.deleteClient({
      clientID: clientID,
    });

    res.status(200).json({
      status: "success",
    });
  });

  deactivateClient = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const loggedInUserID = +res.locals.user.id;

    await clientsRepository.deactivateClient({
      clientID: clientID,
      deletedByID: loggedInUserID,
    });

    res.status(200).json({
      status: "success",
    });
  });

  reactivateClient = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;

    await clientsRepository.reactivateClient({
      clientID: clientID,
    });

    res.status(200).json({
      status: "success",
    });
  });
}
