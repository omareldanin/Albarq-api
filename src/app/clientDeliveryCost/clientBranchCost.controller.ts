import {ClientRole, EmployeeRole} from "@prisma/client";
import {AppError} from "../../lib/AppError";
import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {ClientBranchCostUpsertSchema} from "./clientBranchCost.dto";
import {ClientBranchCostRepository} from "./clientBranchCost.repository";

const clientBranchCostRepository = new ClientBranchCostRepository();

export class ClientBranchCostController {
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

    res.status(200).json({
      status: "success",
      data: costs,
    });
  });

  getResolvedCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const branchID = +req.params.branchID;

    const cost = await clientBranchCostRepository.resolveDeliveryCost({
      clientID,
      branchID,
    });

    if (!cost) {
      throw new AppError("Client not found", 404);
    }

    res.status(200).json({
      status: "success",
      data: cost,
    });
  });

  upsertClientBranchCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const data = ClientBranchCostUpsertSchema.parse(req.body);

    const cost = await clientBranchCostRepository.upsertClientBranchCost({
      clientID,
      data,
    });

    res.status(200).json({
      status: "success",
      data: cost,
    });
  });

  deleteClientBranchCost = catchAsync(async (req, res) => {
    const clientID = +req.params.clientID;
    const branchID = +req.params.branchID;

    await clientBranchCostRepository.deleteClientBranchCost({
      clientID,
      branchID,
    });

    res.status(200).json({
      status: "success",
    });
  });
}
