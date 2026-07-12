import {prisma} from "../../database/db";
import type {ClientBranchCostUpsertType} from "./clientBranchCost.dto";

export class ClientBranchCostRepository {
  // ---------- CLIENT ----------
  getClientBranchCosts = async ({clientID}: {clientID: number}) => {
    return prisma.clientBranchCost.findMany({
      where: {clientId: clientID},
      include: {branch: {select: {id: true, name: true}}},
    });
  };

  getClientBranchCost = async ({
    clientID,
    branchID,
  }: {
    clientID: number;
    branchID: number;
  }) => {
    return prisma.clientBranchCost.findUnique({
      where: {clientId_branchId: {clientId: clientID, branchId: branchID}},
    });
  };

  upsertClientBranchCost = async ({
    clientID,
    data,
  }: {
    clientID: number;
    data: ClientBranchCostUpsertType;
  }) => {
    const {branchID, ...profits} = data;
    return prisma.clientBranchCost.upsert({
      where: {clientId_branchId: {clientId: clientID, branchId: branchID}},
      update: profits,
      create: {clientId: clientID, branchId: branchID, ...profits},
    });
  };

  deleteClientBranchCost = async ({
    clientID,
    branchID,
  }: {
    clientID: number;
    branchID: number;
  }) => {
    return prisma.clientBranchCost.delete({
      where: {clientId_branchId: {clientId: clientID, branchId: branchID}},
    });
  };

  resolveClientDeliveryCost = async ({
    clientID,
    branchID,
  }: {
    clientID: number;
    branchID: number;
  }) => {
    const override = await prisma.clientBranchCost.findUnique({
      where: {clientId_branchId: {clientId: clientID, branchId: branchID}},
    });
    if (!override) return null;
    return {
      branchID,
      deliveryAgentProfit: override.deliveryAgentProfit,
      mainBranchProfit: override.mainBranchProfit,
      forwardedBranchProfit: override.forwardedBranchProfit,
      receivingBranchProfit: override.receivingBranchProfit,
      activeProfit: override.activeProfit,
    };
  };

  // ---------- COMPANY ----------
  getCompanyBranchCosts = async ({companyID}: {companyID: number}) => {
    return prisma.clientBranchCost.findMany({
      where: {companyId: companyID},
      include: {branch: {select: {id: true, name: true}}},
    });
  };

  getCompanyBranchCost = async ({
    companyID,
    branchID,
  }: {
    companyID: number;
    branchID: number;
  }) => {
    return prisma.clientBranchCost.findUnique({
      where: {companyId_branchId: {companyId: companyID, branchId: branchID}},
    });
  };

  upsertCompanyBranchCost = async ({
    companyID,
    data,
  }: {
    companyID: number;
    data: ClientBranchCostUpsertType;
  }) => {
    const {branchID, ...profits} = data;
    return prisma.clientBranchCost.upsert({
      where: {companyId_branchId: {companyId: companyID, branchId: branchID}},
      update: profits,
      create: {companyId: companyID, branchId: branchID, ...profits},
    });
  };

  deleteCompanyBranchCost = async ({
    companyID,
    branchID,
  }: {
    companyID: number;
    branchID: number;
  }) => {
    return prisma.clientBranchCost.delete({
      where: {companyId_branchId: {companyId: companyID, branchId: branchID}},
    });
  };

  resolveCompanyDeliveryCost = async ({
    companyID,
    branchID,
  }: {
    companyID: number;
    branchID: number;
  }) => {
    const override = await prisma.clientBranchCost.findUnique({
      where: {companyId_branchId: {companyId: companyID, branchId: branchID}},
    });
    if (!override) return null;
    return {
      branchID,
      deliveryAgentProfit: override.deliveryAgentProfit,
      mainBranchProfit: override.mainBranchProfit,
      forwardedBranchProfit: override.forwardedBranchProfit,
      receivingBranchProfit: override.receivingBranchProfit,
      activeProfit: override.activeProfit,
    };
  };
}
