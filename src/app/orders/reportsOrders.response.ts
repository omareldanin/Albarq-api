import {Prisma} from "@prisma/client";

export const reportsOrderSelect = {
  id: true,
  totalCost: true,
  paidAmount: true,
  deliveryCost: true,
  clientNet: true,
  deliveryAgentNet: true,
  companyNet: true,
  branchNet: true,
  receiptNumber: true,
  recipientName: true,
  recipientPhones: true,
  recipientAddress: true,
  notes: true,
  clientNotes: true,
  status: true,
  createdAt: true,
  branchDeliveryCost: true,
  weight: true,
  client: {
    select: {
      branchId: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  },
  deliveryAgent: {
    select: {
      deliveryCost: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  governorate: true,
  location: {
    select: {
      id: true,
      name: true,
    },
  },
  store: {
    select: {
      id: true,
      name: true,
    },
  },
  clientReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      secondaryType: true,
      clientId: true,
      storeId: true,
    },
  },
  repositoryReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      secondaryType: true,
      repositoryId: true,
    },
  },
  branchReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      branchId: true,
      type: true,
    },
  },
  deliveryAgentReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      deliveryAgentId: true,
    },
  },
  governorateReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      governorate: true,
    },
  },
  companyReport: {
    where: {
      report: {
        deleted: false,
      },
    },
    select: {
      id: true,
      secondaryType: true,
      companyId: true,
    },
  },
  company: {
    select: {
      id: true,
      name: true,
      logo: true,
      registrationText: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
    },
  },
  repository: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.OrderSelect;

export const reportsOrderReform = (
  order: Prisma.OrderGetPayload<{
    select: typeof reportsOrderSelect;
  }> | null,
) => {
  if (!order) {
    return null;
  }

  const orderReformed = {
    ...order,
    // TODO
    client: {
      id: order.client.user.id,
      name: order.client.user.name,
      phone: order.client.user.phone,
      branchId: order.client.branchId,
    },
    deliveryAgent: order.deliveryAgent && {
      id: order.deliveryAgent.user.id,
      name: order.deliveryAgent.user.name,
      deliveryCost: order.deliveryAgent.deliveryCost,
    },
    clientReport:
      order.clientReport &&
      order.clientReport.map((report) => ({
        id: report?.id,
        secondaryType: report?.secondaryType,
        clientId: report?.clientId,
        storeId: report?.storeId,
      })),
    repositoryReport: order.repositoryReport.map((report) => ({
      id: report?.id,
      secondaryType: report?.secondaryType,
      repositoryId: report?.repositoryId,
    })),
    branchReport: order.branchReport.map((report) => ({
      id: report?.id,
      branchId: report?.branchId,
      type: report.type,
    })),
    deliveryAgentReport: order.deliveryAgentReport && {
      id: order.deliveryAgentReport?.id,
      deliveryAgentId: order.deliveryAgentReport?.deliveryAgentId,
    },
    governorateReport: order.governorateReport && {
      id: order.governorateReport?.id,
      governorate: order.governorateReport?.governorate,
    },
    companyReport: order.companyReport.map((report) => ({
      id: report?.id,
      secondaryType: report?.secondaryType,
      companyId: report?.companyId,
    })),
  };
  return orderReformed;
};
