import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/db";
import type { loggedInUserType } from "../../types/user";
import type { EmployeeCreateType, EmployeeUpdateType, EmployeesFiltersType } from "./employees.dto";
import { employeeReform, employeeSelect } from "./employees.responses";

export class EmployeesRepository {
    async createEmployee(data: {
        companyID: number;
        loggedInUser: loggedInUserType;
        employeeData: EmployeeCreateType;
    }) {
        const createdEmployee = await prisma.employee.create({
            data: {
                user: {
                    create: {
                        name: data.employeeData.name,
                        username: data.employeeData.username,
                        password: data.employeeData.password,
                        phone: data.employeeData.phone,
                        fcm: data.employeeData.fcm,
                        avatar: data.employeeData.avatar
                    }
                },
                idCard: data.employeeData.idCard,
                residencyCard: data.employeeData.residencyCard,
                salary: data.employeeData.salary,
                role: data.employeeData.role,
                company: {
                    connect: {
                        id: data.companyID
                    }
                },
                permissions: data.employeeData.permissions
                    ? {
                          set: data.employeeData.permissions
                      }
                    : undefined,
                branch: data.employeeData.branchID
                    ? {
                          connect: {
                              id: data.employeeData.branchID
                          }
                      }
                    : undefined,
                repository: data.employeeData.repositoryID
                    ? {
                          connect: {
                              id: data.employeeData.repositoryID
                          }
                      }
                    : undefined,
                managedStores: data.employeeData.storesIDs
                    ? {
                          connect: data.employeeData.storesIDs.map((storeID) => {
                              return {
                                  id: storeID
                              };
                          })
                      }
                    : undefined,
                inquiryStores: data.employeeData.inquiryStoresIDs
                    ? {
                          create: data.employeeData.inquiryStoresIDs.map((storeID) => {
                              return {
                                  store: {
                                      connect: {
                                          id: storeID
                                      }
                                  }
                              };
                          })
                      }
                    : undefined,
                inquiryLocations: data.employeeData.inquiryLocationsIDs
                    ? {
                          createMany: {
                              data: data.employeeData.inquiryLocationsIDs.map((locationID) => {
                                  return {
                                      locationId: locationID
                                  };
                              })
                          }
                      }
                    : undefined,
                inquiryBranches: data.employeeData.inquiryBranchesIDs
                    ? {
                          createMany: {
                              data: data.employeeData.inquiryBranchesIDs.map((branchID) => {
                                  return {
                                      branchId: branchID
                                  };
                              })
                          }
                      }
                    : undefined,
                inquiryCompanies: data.employeeData.inquiryCompaniesIDs
                    ? {
                          createMany: {
                              data: data.employeeData.inquiryCompaniesIDs.map((companyID) => {
                                  return {
                                      companyId: companyID
                                  };
                              })
                          }
                      }
                    : undefined,
                // inquiryDeliveryAgents: data.employeeData.inquiryDeliveryAgentsIDs
                //     ? {
                //           createMany: {
                //               data: data.employeeData.inquiryDeliveryAgentsIDs.map((deliveryAgentID) => {
                //                   return {
                //                       deliveryAgentId: deliveryAgentID
                //                   };
                //               })
                //           }
                //       }
                //     : undefined,
                inquiryGovernorates: data.employeeData.inquiryGovernorates
                    ? {
                          set: data.employeeData.inquiryGovernorates
                      }
                    : undefined,
                inquiryStatuses: data.employeeData.inquiryStatuses
                    ? {
                          set: data.employeeData.inquiryStatuses
                      }
                    : undefined,
                createdBy: {
                    connect: {
                        id: data.loggedInUser.id
                    }
                }
            },
            select: employeeSelect
        });
        return employeeReform(createdEmployee);
    }

    async getAllEmployeesPaginated(data: { filters: EmployeesFiltersType }) {
        const where = {
            AND: [
                {
                    permissions: data.filters.permissions ? { hasEvery: data.filters.permissions } : undefined
                },
                { user: data.filters.name ? { name: { contains: data.filters.name } } : undefined },
                { user: data.filters.phone ? { phone: { contains: data.filters.phone } } : undefined },
                { role: { in: data.filters.roles } },
                { role: data.filters.role },
                {
                    branch: {
                        id: data.filters.branchID
                    }
                },
                {
                    deliveryAgentsLocations: data.filters.locationID
                        ? data.filters.roles?.find((role) => {
                              return role === "DELIVERY_AGENT" || role === "RECEIVING_AGENT";
                          })
                            ? {
                                  some: {
                                      location: {
                                          id: data.filters.locationID
                                      }
                                  }
                              }
                            : undefined
                        : undefined
                },
                { deleted: data.filters.deleted },
                {
                    company: {
                        id: data.filters.companyID
                    }
                }
            ]
        } satisfies Prisma.EmployeeWhereInput;

        if (data.filters.minified === true) {
            const employees = await prisma.employee.findManyPaginated(
                {
                    where: where,
                    select: {
                        id: true,
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                {
                    page: data.filters.page,
                    size: data.filters.size
                }
            );
            return {
                employees: employees.data.map((employee) => {
                    return {
                        id: employee.id,
                        name: employee.user.name
                    };
                }),
                pagesCount: employees.pagesCount
            };
        }

        const employees = await prisma.employee.findManyPaginated(
            {
                where: where,
                orderBy: {
                    id: "asc"
                },
                select: {
                    ...employeeSelect,
                    _count: {
                        select: {
                            orders: {
                                where: {
                                    createdAt: {
                                        gte: data.filters.ordersStartDate,
                                        lte: data.filters.ordersEndDate
                                    },
                                    confirmed: true,
                                    deleted: false
                                }
                            }
                            // deliveryAgentsLocations: true
                        }
                    }
                }
            },
            {
                page: data.filters.page,
                size: data.filters.size
            }
        );

        return {
            employees: employees.data.map(employeeReform),
            pagesCount: employees.pagesCount
        };
    }

    async getInquiryEmployeeStuff(data: { employeeID: number }) {
        const employee = await prisma.employee.findUnique({
            where: {
                id: data.employeeID
            },
            select: {
                // id: true,
                // user: {
                //     select: {
                //         name: true
                //     }
                // }
                inquiryBranches: {
                    select: {
                        branch: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                inquiryLocations: {
                    select: {
                        location: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                inquiryCompanies: {
                    select: {
                        company: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                inquiryStores: {
                    select: {
                        store: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                inquiryGovernorates: true,
                inquiryStatuses: true
            }
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
            inquiryGovernorates: employee?.inquiryGovernorates,
            inquiryStatuses: employee?.inquiryStatuses
        };
    }

    async getEmployee(data: { employeeID: number }) {
        const employee = await prisma.employee.findUnique({
            where: {
                id: data.employeeID
            },
            select: employeeSelect
        });
        return employeeReform(employee);
    }

    async updateEmployee(data: {
        employeeID: number;
        // companyID: number;
        employeeData: EmployeeUpdateType;
    }) {
        const employee = await prisma.employee.update({
            where: {
                id: data.employeeID
            },
            data: {
                user: {
                    update: {
                        name: data.employeeData.name,
                        username: data.employeeData.username,
                        password: data.employeeData.password,
                        phone: data.employeeData.phone,
                        fcm: data.employeeData.fcm,
                        avatar: data.employeeData.avatar
                    }
                },
                idCard: data.employeeData.idCard,
                residencyCard: data.employeeData.residencyCard,
                salary: data.employeeData.salary,
                role: data.employeeData.role,
                // company: data.employeeData.companyID
                //     ? {
                //           connect: {
                //               id: data.employeeData.companyID
                //           }
                //       }
                //     : undefined,
                permissions: data.employeeData.permissions,
                branch: data.employeeData.branchID
                    ? {
                          connect: {
                              id: data.employeeData.branchID
                          }
                      }
                    : undefined,
                repository: data.employeeData.repositoryID
                    ? {
                          connect: {
                              id: data.employeeData.repositoryID
                          }
                      }
                    : undefined,
                managedStores: data.employeeData.storesIDs
                    ? {
                          set: data.employeeData.storesIDs.map((storeID) => {
                              return {
                                  id: storeID
                              };
                          })
                      }
                    : undefined,
                inquiryStores: data.employeeData.inquiryStoresIDs
                    ? {
                          deleteMany: {
                              inquiryEmployeeId: data.employeeID
                          },
                          create: data.employeeData.inquiryStoresIDs.map((storeID) => {
                              return {
                                  store: {
                                      connect: {
                                          id: storeID
                                      }
                                  }
                              };
                          })
                      }
                    : undefined,
                inquiryBranches: data.employeeData.inquiryBranchesIDs
                    ? {
                          deleteMany: {
                              inquiryEmployeeId: data.employeeID
                          },
                          createMany: {
                              data: data.employeeData.inquiryBranchesIDs.map((branchID) => {
                                  return {
                                      branchId: branchID
                                  };
                              })
                          }
                      }
                    : undefined,
                inquiryCompanies: data.employeeData.inquiryCompaniesIDs
                    ? {
                          deleteMany: {
                              inquiryEmployeeId: data.employeeID
                          },
                          createMany: {
                              data: data.employeeData.inquiryCompaniesIDs.map((companyID) => {
                                  return {
                                      companyId: companyID
                                  };
                              })
                          }
                      }
                    : undefined,
                // inquiryDeliveryAgents: data.employeeData.inquiryDeliveryAgentsIDs
                //     ? {
                //           deleteMany: {
                //               inquiryEmployeeId: data.employeeID
                //           },
                //           createMany: {
                //               data: data.employeeData.inquiryDeliveryAgentsIDs.map((deliveryAgentID) => {
                //                   return {
                //                       deliveryAgentId: deliveryAgentID
                //                   };
                //               })
                //           }
                //       }
                //     : undefined,
                inquiryGovernorates: data.employeeData.inquiryGovernorates
                    ? {
                          set: data.employeeData.inquiryGovernorates
                      }
                    : undefined,
                inquiryStatuses: data.employeeData.inquiryStatuses
                    ? {
                          set: data.employeeData.inquiryStatuses
                      }
                    : undefined,
                inquiryLocations: data.employeeData.inquiryLocationsIDs
                    ? {
                          deleteMany: {
                              inquiryEmployeeId: data.employeeID
                          },
                          createMany: {
                              data: data.employeeData.inquiryLocationsIDs.map((locationID) => {
                                  return {
                                      locationId: locationID
                                  };
                              })
                          }
                      }
                    : undefined
            },
            select: employeeSelect
        });
        return employeeReform(employee);
    }

    async deleteEmployee(data: { employeeID: number }) {
        await prisma.$transaction([
            prisma.employee.delete({
                where: {
                    id: data.employeeID
                }
            }),
            prisma.user.delete({
                where: {
                    id: data.employeeID
                }
            })
        ]);
        return true;
    }

    async deactivateEmployee(data: {
        employeeID: number;
        deletedByID: number;
    }) {
        const deletedEmployee = await prisma.employee.update({
            where: {
                id: data.employeeID
            },
            data: {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: {
                    connect: {
                        id: data.deletedByID
                    }
                }
            }
        });
        return deletedEmployee;
    }

    async reactivateEmployee(data: { employeeID: number }) {
        const deletedEmployee = await prisma.employee.update({
            where: {
                id: data.employeeID
            },
            data: {
                deleted: false
            }
        });
        return deletedEmployee;
    }

    async getCompanyManager(data: { companyID: number }) {
        const companyManager = await prisma.employee.findFirst({
            where: {
                role: "COMPANY_MANAGER",
                company: {
                    id: data.companyID
                }
            },
            orderBy: {
                id: "asc"
            },
            select: {
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        return {
            id: companyManager?.user.id,
            name: companyManager?.user.name
        };
    }

    // TODO: Move to Employees repository
    async getDeliveryAgentIDByLocationID(data: { locationID: number }) {
        const deliveryAgent = await prisma.employee.findFirst({
            where: {
                role: "DELIVERY_AGENT",
                deliveryAgentsLocations: {
                    some: {
                        locationId: data.locationID
                    }
                }
            },
            select: {
                id: true
            }
        });
        return deliveryAgent?.id;
    }
}
