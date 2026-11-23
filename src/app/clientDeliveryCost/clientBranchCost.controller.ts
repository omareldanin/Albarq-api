import {AdminRole, ClientRole, EmployeeRole} from "@prisma/client";
import {AppError} from "../../lib/AppError";
import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {
  ClientBranchCostUpsertSchema,
  StoreActiveProfitSchema,
} from "./clientBranchCost.dto";
import {ClientBranchCostRepository} from "./clientBranchCost.repository";

const clientBranchCostRepository = new ClientBranchCostRepository();

/** Company managers may only manage stores of their own company; admins any store. */
const assertStoreAccess = async (storeID: number, loggedInUser: loggedInUserType) => {
  if (!Number.isSafeInteger(storeID) || storeID < 1) {
    throw new AppError("المتجر غير موجود", 404);
  }
  const companyId = await clientBranchCostRepository.getStoreCompanyId({storeID});
  const isAdmin =
    loggedInUser.role === AdminRole.ADMIN ||
    loggedInUser.role === AdminRole.ADMIN_ASSISTANT;
  if (companyId === null || (!isAdmin && companyId !== loggedInUser.companyID)) {
    throw new AppError("المتجر غير موجود", 404);
  }
};

export class ClientBranchCostController {
  // ---------- CLIENT ----------
  getClientBranchCosts = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const loggedInUser = res.locals.user as loggedInUserType;

    if (
      (loggedInUser.role === ClientRole.CLIENT ||
        loggedInUser.role === EmployeeRole.CLIENT_ASSISTANT) &&
      clientID !== loggedInUser.id
    ) {
      throw new AppError("غير مصرح لك الاطلاع علي بيانات عميل اخر", 403);
    }

    const costs = await clientBranchCostRepository.getClientBranchCosts({
      clientID,
    });

    res.status(200).json({status: "success", data: costs});
  });

  getResolvedCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const branchID = +req.params.branchID;

    const cost = await clientBranchCostRepository.resolveClientDeliveryCost({
      clientID,
      branchID,
    });

    if (!cost) {
      throw new AppError("لا توجد تكلفة محددة لهذا الفرع", 404);
    }

    res.status(200).json({status: "success", data: cost});
  });

  upsertClientBranchCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const data = ClientBranchCostUpsertSchema.parse(req.body);

    const cost = await clientBranchCostRepository.upsertClientBranchCost({
      clientID,
      data,
    });

    res.status(200).json({status: "success", data: cost});
  });

  deleteClientBranchCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const branchID = +req.params.branchID;

    await clientBranchCostRepository.deleteClientBranchCost({
      clientID,
      branchID,
    });

    res.status(200).json({status: "success"});
  });

  // ---------- COMPANY ----------
  getCompanyBranchCosts = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;

    const costs = await clientBranchCostRepository.getCompanyBranchCosts({
      companyID,
    });

    res.status(200).json({status: "success", data: costs});
  });

  getCompanyResolvedCost = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;
    const branchID = +req.params.branchID;

    const cost = await clientBranchCostRepository.resolveCompanyDeliveryCost({
      companyID,
      branchID,
    });

    if (!cost) {
      throw new AppError("لا توجد تكلفة محددة لهذا الفرع", 404);
    }

    res.status(200).json({status: "success", data: cost});
  });

  upsertCompanyBranchCost = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;
    const data = ClientBranchCostUpsertSchema.parse(req.body);

    const cost = await clientBranchCostRepository.upsertCompanyBranchCost({
      companyID,
      data,
    });

    res.status(200).json({status: "success", data: cost});
  });

  deleteCompanyBranchCost = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;
    const branchID = +req.params.branchID;

    await clientBranchCostRepository.deleteCompanyBranchCost({
      companyID,
      branchID,
    });

    res.status(200).json({status: "success"});
  });

  // ---------- STORE ----------
  getStoreBranchCosts = catchAsync(async (req, res) => {
    const storeID = +req.params.storeID;
    await assertStoreAccess(storeID, res.locals.user as loggedInUserType);

    const data = await clientBranchCostRepository.getStoreBranchCosts({storeID});

    res.status(200).json({status: "success", data});
  });

  upsertStoreBranchCost = catchAsync(async (req, res) => {
    const storeID = +req.params.storeID;
    await assertStoreAccess(storeID, res.locals.user as loggedInUserType);
    const data = ClientBranchCostUpsertSchema.parse(req.body);

    const cost = await clientBranchCostRepository.upsertStoreBranchCost({
      storeID,
      data,
    });

    res.status(200).json({status: "success", data: cost});
  });

  deleteStoreBranchCost = catchAsync(async (req, res) => {
    const storeID = +req.params.storeID;
    const branchID = +req.params.branchID;
    await assertStoreAccess(storeID, res.locals.user as loggedInUserType);

    await clientBranchCostRepository.deleteStoreBranchCost({storeID, branchID});

    res.status(200).json({status: "success"});
  });

  setStoreActiveProfit = catchAsync(async (req, res) => {
    const storeID = +req.params.storeID;
    await assertStoreAccess(storeID, res.locals.user as loggedInUserType);
    const {activeProfit} = StoreActiveProfitSchema.parse(req.body);

    const store = await clientBranchCostRepository.setStoreActiveProfit({
      storeID,
      activeProfit,
    });

    res.status(200).json({status: "success", data: store});
  });
}
