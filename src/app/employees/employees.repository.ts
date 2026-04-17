import type {Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import type {loggedInUserType} from "../../types/user";
import type {
  EmployeeCreateType,
  EmployeeUpdateType,
  EmployeesFiltersType,
} from "./employees.dto";
import {employeeReform, employeeSelect} from "./employees.responses";
import {redis} from "../../lib/redis";

export class EmployeesRepository {
  employeesCacheKey(data: {
    filters: EmployeesFiltersType;
    loggedInUser: loggedInUserType;
  }) {
    return `employees:${JSON.stringify({
      filters: {
        ...data.filters,
        ordersStartDate: data.filters.ordersStartDate ?? null,
        ordersEndDate: data.filters.ordersEndDate ?? null,
      },
      role: data.loggedInUser.role,
      companyID: data.loggedInUser.companyID ?? null,
      userID: data.loggedInUser.id ?? null, // safety
    })}`;
  }

  async createEmployee(data: {
    companyID: number;
    loggedInUser: loggedInUserType;
    employeeData: EmployeeCreateType;
  }) {
    const keys = await redis.keys("employees:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const employee = await prisma.employee.findUnique({
      where: {
        id: data.loggedInUser.id,
      },
      select: {
        clientId: true,
      },
    });

    const clientConnect =
      data.employeeData.role === "CLIENT_ASSISTANT"
        ? {
            connect: {
              id:
                data.loggedInUser.role === "CLIENT"
                  ? data.loggedInUser.id
                  : employee?.clientId!,
            },
          }
        : undefined;

    const createdEmployee = await prisma.employee.create({
      data: {
        user: {
          create: {
            name: data.employeeData.name,
            username: data.employeeData.username,
            password: data.employeeData.password,
            phone: data.employeeData.phone,
            fcm: data.employeeData.fcm,
            avatar: data.employeeData.avatar,
          },
        },
        idCard: data.employeeData.idCard,
        residencyCard: data.employeeData.residencyCard,
        clientAssistantRole: data.employeeData.clientAssistantRole,
        salary: data.employeeData.salary,
        orderType: data.employeeData.orderType,
        role:
          data.employeeData.role === "EMERGENCY_EMPLOYEE" ||
          data.employeeData.role === "MAIN_EMERGENCY_EMPLOYEE"
            ? "INQUIRY_EMPLOYEE"
            : data.employeeData.role,
        emergency:
          data.employeeData.role === "EMERGENCY_EMPLOYEE" ? true : false,
        mainEmergency:
          data.employeeData.role === "MAIN_EMERGENCY_EMPLOYEE" ? true : false,
        Client: clientConnect,
        company: {
          connect: {
            id: data.companyID,
          },
        },
        permissions: data.employeeData.permissions
          ? {
              set: data.employeeData.permissions,
            }
          : undefined,
        orderStatus: data.employeeData.orderStatus
          ? {
              set: data.employeeData.orderStatus,
            }
          : undefined,
        branch: data.employeeData.branchID
          ? {
              connect: {
                id: data.employeeData.branchID,
              },
            }
          : undefined,
        repository: data.employeeData.repositoryID
          ? {
              connect: {
                id: data.employeeData.repositoryID,
              },
            }
          : undefined,
        inquiryStores: data.employeeData.inquiryStoresIDs
          ? {
              create: data.employeeData.inquiryStoresIDs.map((storeID) => {
                return {
                  store: {
                    connect: {
                      id: storeID,
                    },
                  },
                };
              }),
            }
          : data.employeeData.storesIDs
            ? {
                create: data.employeeData.storesIDs.map((storeID) => {
                  return {
                    store: {
                      connect: {
                        id: storeID,
                      },
                    },
                  };
                }),
              }
            : undefined,
        inquiryLocations: data.employeeData.inquiryLocationsIDs
          ? {
              createMany: {
                data: data.employeeData.inquiryLocationsIDs.map(
                  (locationID) => {
                    return {
                      locationId: locationID,
                    };
                  },
                ),
              },
            }
          : undefined,
        inquiryBranches: data.employeeData.inquiryBranchesIDs
          ? {
              createMany: {
                data: data.employeeData.inquiryBranchesIDs.map((branchID) => {
                  return {
                    branchId: branchID,
                  };
                }),
              },
            }
          : undefined,
        inquiryCompanies: data.employeeData.inquiryCompaniesIDs
          ? {
              createMany: {
                data: data.employeeData.inquiryCompaniesIDs.map((companyID) => {
                  return {
                    companyId: companyID,
                  };
                }),
              },
            }
          : undefined,
        inquiryGovernorates: data.employeeData.inquiryGovernorates
          ? {
              set: data.employeeData.inquiryGovernorates,
            }
          : undefined,
        inquiryStatuses: data.employeeData.inquiryStatuses
          ? {
              set: data.employeeData.inquiryStatuses,
            }
          : undefined,
        createdBy: {
          connect: {
            id: data.loggedInUser.id,
          },
        },
      },
      select: employeeSelect,
    });
    if (data.employeeData.inquiryDeliveryAgentsIDs?.length) {
      await prisma.inquiryEmployeesDeliveryAgents.createMany({
        data: data.employeeData.inquiryDeliveryAgentsIDs.map((id) => ({
          deliveryAgentId: id,
          inquiryEmployeeId: createdEmployee.user.id,
        })),
      });
    }
    return employeeReform(createdEmployee);
  }

  async getAllEmployeesPaginated(data: {
    filters: EmployeesFiltersType;
    loggedInUser: loggedInUserType;
  }) {
    const cacheKey = this.employeesCacheKey(data);

    // 1️⃣ Redis first (FAST PATH)
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as {
        employees: any[];
        pagesCount: number;
      };
    }

    // -----------------------------
    // ORIGINAL LOGIC (UNCHANGED)
    // -----------------------------

    let emergency = false;
    let mainEmergency = false;

    if (data.filters.roles?.includes("EMERGENCY_EMPLOYEE")) emergency = true;
    if (data.filters.roles?.includes("MAIN_EMERGENCY_EMPLOYEE"))
      mainEmergency = true;

    let deliveryStartDate = data.filters.ordersStartDate
      ? new Date(data.filters.ordersStartDate)
      : new Date();

    let deliveryEndDate = data.filters.ordersEndDate
      ? new Date(data.filters.ordersEndDate)
      : new Date();

    const where = {
      AND: [
        {
          permissions: data.filters.permissions
            ? {hasEvery: data.filters.permissions}
            : undefined,
        },
        {
          user: data.filters.name
            ? {name: {contains: data.filters.name}}
            : undefined,
        },
        {
          user: data.filters.phone
            ? {phone: {contains: data.filters.phone}}
            : undefined,
        },
        {
          role:
            data.loggedInUser.role !== "CLIENT" &&
            data.loggedInUser.role !== "CLIENT_ASSISTANT" &&
            !data.filters.roles
              ? {not: "CLIENT_ASSISTANT"}
              : {in: data.filters.roles},
        },
        {
          clientId:
            data.loggedInUser.role !== "CLIENT" &&
            data.loggedInUser.role !== "CLIENT_ASSISTANT"
              ? null
              : undefined,
        },
        {role: data.filters.role},
        {
          emergency:
            data.filters.role === "INQUIRY_EMPLOYEE" ||
            data.filters.roles?.includes("INQUIRY_EMPLOYEE")
              ? false
              : undefined,
        },
        {
          mainEmergency:
            data.filters.role === "INQUIRY_EMPLOYEE" ||
            data.filters.roles?.includes("INQUIRY_EMPLOYEE")
              ? false
              : undefined,
        },

        {
          Client: {id: data.filters.clientId},
        },
        {
          deliveryAgentsLocations: data.filters.locationID
            ? data.filters.roles?.some(
                (r) => r === "DELIVERY_AGENT" || r === "RECEIVING_AGENT",
              )
              ? {
                  some: {
                    location: {id: data.filters.locationID},
                  },
                }
              : undefined
            : undefined,
        },
        {deleted: data.filters.deleted},
        {
          company: {id: data.filters.companyID},
        },
        {
          OR: [
            {
              branch: data.filters.branchID
                ? {id: data.filters.branchID}
                : undefined,
            },
            {
              branch: data.filters.branchID
                ? {parentBranchId: data.filters.branchID}
                : undefined,
            },
          ],
        },
      ],
    } satisfies Prisma.EmployeeWhereInput;

    let result;

    // -----------------------------
    // MINIFIED
    // -----------------------------
    if (data.filters.minified === true) {
      const employees = await prisma.employee.findManyPaginated(
        {
          where,
          select: {
            id: true,
            branchId: true,
            user: {select: {name: true}},
          },
        },
        {
          page: data.filters.page,
          size: data.filters.size,
        },
      );

      result = {
        employees: employees.data.map((e) => ({
          id: e.id,
          name: e.user.name,
          branchId: e.branchId,
        })),
        pagesCount: employees.pagesCount,
      };
    } else {
      // -----------------------------
      // FULL
      // -----------------------------
      const employees = await prisma.employee.findManyPaginated(
        {
          where: {
            OR: [
              where,
              emergency
                ? {
                    emergency: true,
                    role: "INQUIRY_EMPLOYEE",
                    companyId: data.loggedInUser.companyID ?? undefined,
                  }
                : mainEmergency
                  ? {
                      mainEmergency: true,
                      role: "INQUIRY_EMPLOYEE",
                      companyId: data.loggedInUser.companyID ?? undefined,
                    }
                  : {},
            ],
          },
          orderBy: {id: "asc"},
          select: {
            ...employeeSelect,
            _count: {
              select: {
                orders: {
                  where: {
                    AND: [
                      {confirmed: true},
                      {deleted: false},
                      {
                        deliveryDate: data.filters.ordersStartDate
                          ? {gte: deliveryStartDate}
                          : undefined,
                      },
                      {
                        deliveryDate: data.filters.ordersEndDate
                          ? {lt: deliveryEndDate}
                          : undefined,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          page: data.filters.page,
          size: data.filters.size,
        },
      );

      result = {
        employees: employees.data.map(employeeReform),
        pagesCount: employees.pagesCount,
      };
    }

    // 3️⃣ Save to Redis (TTL = 10 minutes)
    await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24 * 2);

    return result;
  }

  async getInquiryEmployeeStuff(data: {employeeID: number}) {
    const employee = await prisma.employee.findUnique({
      where: {
        id: data.employeeID,
      },
      select: {
        orderType: true,
        inquiryBranches: {
          select: {
            branch: {
              select: {
                id: true,
              },
            },
          },
        },
        inquiryLocations: {
          select: {
            location: {
              select: {
                id: true,
              },
            },
          },
        },
        inquiryCompanies: {
          select: {
            company: {
              select: {
                id: true,
              },
            },
          },
        },
        inquiryStores: {
          select: {
            store: {
              select: {
                id: true,
              },
            },
          },
        },
        inquiryDeliveryAgents: {
          select: {
            deliveryAgent: {
              select: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        inquiryClients: {
          select: {
            client: {
              select: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        inquiryGovernorates: true,
        inquiryStatuses: true,
      },
    });
    return {
      inquiryBranches: employee?.inquiryBranches.map((branch) => {
        return branch.branch.id;
      }),
      inquiryLocations: employee?.inquiryLocations.map((location) => {
        return location.location.id;
      }),
      inquiryCompanies: employee?.inquiryCompanies.map((company) => {
        return company.company.id;
      }),
      inquiryStores: employee?.inquiryStores.map((store) => {
        return store.store.id;
      }),
      inquiryClients: employee?.inquiryClients.map((client) => {
        return client.client.user.id;
      }),
      inquiryDeliveryAgents: employee?.inquiryDeliveryAgents.map((agent) => {
        return agent.deliveryAgent.user.id;
      }),
      inquiryGovernorates: employee?.inquiryGovernorates,
      inquiryStatuses: employee?.inquiryStatuses,
      orderType: employee?.orderType,
    };
  }

  async getEmployee(data: {employeeID: number}) {
    const employee = await prisma.employee.findUnique({
      where: {
        id: data.employeeID,
      },
      select: employeeSelect,
    });

    return employeeReform(employee);
  }

  async updateEmployee(data: {
    employeeID: number;
    // companyID: number;
    employeeData: EmployeeUpdateType;
  }) {
    const keys = await redis.keys("employees:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const employee = await prisma.employee.update({
      where: {
        id: data.employeeID,
      },
      data: {
        user: {
          update: {
            name: data.employeeData.name,
            username: data.employeeData.username,
            password: data.employeeData.password,
            phone: data.employeeData.phone,
            fcm: data.employeeData.fcm,
            avatar: data.employeeData.avatar,
          },
        },
        idCard: data.employeeData.idCard,
        residencyCard: data.employeeData.residencyCard,
        clientAssistantRole: data.employeeData.clientAssistantRole,
        orderType: data.employeeData.orderType,
        salary: data.employeeData.salary,
        role:
          data.employeeData.role === "EMERGENCY_EMPLOYEE" ||
          data.employeeData.role === "MAIN_EMERGENCY_EMPLOYEE"
            ? "INQUIRY_EMPLOYEE"
            : data.employeeData.role,
        emergency:
          data.employeeData.role === "EMERGENCY_EMPLOYEE" ? true : false,
        mainEmergency:
          data.employeeData.role === "MAIN_EMERGENCY_EMPLOYEE" ? true : false,
        permissions: data.employeeData.permissions,
        orderStatus: data.employeeData.orderStatus,
        branch: data.employeeData.branchID
          ? {
              connect: {
                id: data.employeeData.branchID,
              },
            }
          : undefined,
        repository: data.employeeData.repositoryID
          ? {
              connect: {
                id: data.employeeData.repositoryID,
              },
            }
          : undefined,
        inquiryClients: data.employeeData.inquiryClientsIDs
          ? {
              deleteMany: {
                agentId: data.employeeID,
              },
              create: data.employeeData.inquiryClientsIDs.map((clientId) => {
                return {
                  client: {
                    connect: {
                      id: clientId,
                    },
                  },
                };
              }),
            }
          : undefined,
        inquiryStores: data.employeeData.inquiryStoresIDs
          ? {
              deleteMany: {
                inquiryEmployeeId: data.employeeID,
              },
              create: data.employeeData.inquiryStoresIDs.map((storeID) => {
                return {
                  store: {
                    connect: {
                      id: storeID,
                    },
                  },
                };
              }),
            }
          : data.employeeData.storesIDs
            ? {
                deleteMany: {
                  inquiryEmployeeId: data.employeeID,
                },
                create: data.employeeData.storesIDs.map((storeID) => {
                  return {
                    store: {
                      connect: {
                        id: storeID,
                      },
                    },
                  };
                }),
              }
            : undefined,
        inquiryBranches: data.employeeData.inquiryBranchesIDs
          ? {
              deleteMany: {
                inquiryEmployeeId: data.employeeID,
              },
              createMany: {
                data: data.employeeData.inquiryBranchesIDs.map((branchID) => {
                  return {
                    branchId: branchID,
                  };
                }),
              },
            }
          : undefined,
        inquiryCompanies: data.employeeData.inquiryCompaniesIDs
          ? {
              deleteMany: {
                inquiryEmployeeId: data.employeeID,
              },
              createMany: {
                data: data.employeeData.inquiryCompaniesIDs.map((companyID) => {
                  return {
                    companyId: companyID,
                  };
                }),
              },
            }
          : undefined,
        inquiryGovernorates: data.employeeData.inquiryGovernorates
          ? {
              set: data.employeeData.inquiryGovernorates,
            }
          : undefined,
        inquiryStatuses: data.employeeData.inquiryStatuses
          ? {
              set: data.employeeData.inquiryStatuses,
            }
          : undefined,

        inquiryLocations: data.employeeData.inquiryLocationsIDs
          ? {
              deleteMany: {
                inquiryEmployeeId: data.employeeID,
              },
              createMany: {
                data: data.employeeData.inquiryLocationsIDs.map(
                  (locationID) => {
                    return {
                      locationId: locationID,
                    };
                  },
                ),
              },
            }
          : undefined,
      },
      select: employeeSelect,
    });
    await prisma.inquiryEmployeesDeliveryAgents.deleteMany({
      where: {
        inquiryEmployeeId: data.employeeID,
      },
    });
    console.log(
      "inquiryDeliveryAgentsIDs",
      data.employeeData.inquiryDeliveryAgentsIDs,
    );

    if (data.employeeData.inquiryDeliveryAgentsIDs?.length) {
      await prisma.inquiryEmployeesDeliveryAgents.createMany({
        data: data.employeeData.inquiryDeliveryAgentsIDs.map((id) => ({
          deliveryAgentId: id,
          inquiryEmployeeId: data.employeeID,
        })),
      });
    }
    return employeeReform(employee);
  }

  async deleteEmployee(data: {employeeID: number}) {
    const keys = await redis.keys("employees:*");
    if (keys.length) {
      await redis.del(keys);
    }

    await prisma.$transaction([
      prisma.usersLoginHistory.deleteMany({
        where: {
          userId: data.employeeID,
        },
      }),
      prisma.employee.delete({
        where: {
          id: data.employeeID,
        },
      }),
      prisma.user.delete({
        where: {
          id: data.employeeID,
        },
      }),
    ]);
    return true;
  }

  async deactivateEmployee(data: {employeeID: number; deletedByID: number}) {
    const keys = await redis.keys("employees:*");
    if (keys.length) {
      await redis.del(keys);
    }
    const deletedEmployee = await prisma.employee.update({
      where: {
        id: data.employeeID,
      },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: {
          connect: {
            id: data.deletedByID,
          },
        },
      },
    });
    return deletedEmployee;
  }

  async reactivateEmployee(data: {employeeID: number}) {
    const keys = await redis.keys("employees:*");
    if (keys.length) {
      await redis.del(keys);
    }
    const deletedEmployee = await prisma.employee.update({
      where: {
        id: data.employeeID,
      },
      data: {
        deleted: false,
      },
    });
    return deletedEmployee;
  }

  async getCompanyManager(data: {companyID: number}) {
    const companyManager = await prisma.employee.findFirst({
      where: {
        role: "COMPANY_MANAGER",
        company: {
          id: data.companyID,
        },
      },
      orderBy: {
        id: "asc",
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return {
      id: companyManager?.user.id,
      name: companyManager?.user.name,
    };
  }

  // TODO: Move to Employees repository
  async getDeliveryAgentIDByLocationID(data: {locationID: number}) {
    const deliveryAgent = await prisma.employee.findFirst({
      where: {
        role: "DELIVERY_AGENT",
        deliveryAgentsLocations: {
          some: {
            locationId: data.locationID,
          },
        },
      },
      select: {
        id: true,
      },
    });
    return deliveryAgent?.id;
  }
}
