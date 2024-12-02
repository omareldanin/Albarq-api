import type { Governorate, Prisma } from "@prisma/client";
import { prisma } from "../../database/db";
import type { loggedInUserType } from "../../types/user";
import type { LocationCreateType, LocationUpdateType } from "./locations.dto";
import { locationReform, locationSelect } from "./locations.responses";

export class LocationsRepository {
    async createLocation(loggedInUser: loggedInUserType, data: LocationCreateType) {
        const createdLocation = await prisma.location.create({
            data: {
                name: data.name,
                governorate: data.governorate,
                remote: data.remote,
                branch: {
                    connect: {
                        id: data.branchID
                    }
                },
                deliveryAgentsLocations: data.deliveryAgentsIDs
                    ? {
                          create: data.deliveryAgentsIDs?.map((id) => {
                              return {
                                  deliveryAgent: {
                                      connect: {
                                          id: id
                                      }
                                  },
                                  company: {
                                      connect: {
                                          id: loggedInUser.companyID as number
                                      }
                                  }
                              };
                          })
                      }
                    : undefined
                // company: {
                //     connect: {
                //         id: companyID
                //     }
                // }
            },
            select: locationSelect
        });
        return locationReform(createdLocation);
    }

    async getAllLocationsPaginated(filters: {
        page: number;
        size: number;
        search?: string;
        branchID?: number;
        governorate?: Governorate;
        deliveryAgentID?: number;
        companyID?: number;
        minified?: boolean;
    }) {
        const where = {
            AND: [
                {
                    name: {
                        contains: filters.search
                    }
                },
                {
                    branch: {
                        id: filters.branchID
                    }
                },
                {
                    governorate: filters.governorate
                },
                {
                    deliveryAgentsLocations: filters.deliveryAgentID
                        ? {
                              some: {
                                  deliveryAgent: {
                                      id: filters.deliveryAgentID
                                  }
                              }
                          }
                        : undefined
                }
                // {
                //     company: {
                //         id: filters.companyID
                //     }
                // }
            ]
        } satisfies Prisma.LocationWhereInput;

        if (filters.minified === true) {
            const paginatedLocations = await prisma.location.findManyPaginated(
                {
                    where: where,
                    select: {
                        id: true,
                        name: true
                    }
                },
                {
                    page: filters.page,
                    size: filters.size
                }
            );
            return {
                locations: paginatedLocations.data,
                pagesCount: paginatedLocations.pagesCount
            };
        }

        const paginatedLocations = await prisma.location.findManyPaginated(
            {
                where: where,
                // orderBy: {
                //     id: "desc"
                // },
                select: {
                    ...locationSelect,
                    // This makes sure that only delivery agents that belong to the loggedin user company are returned
                    deliveryAgentsLocations: {
                        select: locationSelect.deliveryAgentsLocations.select,
                        where: {
                            company: {
                                id: filters.companyID
                            }
                        }
                    }
                }
            },
            {
                page: filters.page,
                size: filters.size
            }
        );

        return {
            locations: paginatedLocations.data.map(locationReform),
            pagesCount: paginatedLocations.pagesCount
        };
    }

    async getLocation(data: { locationID: number }) {
        const location = await prisma.location.findUnique({
            where: {
                id: data.locationID
            },
            select: locationSelect
        });
        return locationReform(location);
    }

    async updateLocation(data: {
        loggedInUser: loggedInUserType;
        locationID: number;
        locationData: LocationUpdateType;
    }) {
        const location = await prisma.location.update({
            where: {
                id: data.locationID
            },
            data: {
                name: data.locationData.name,
                governorate: data.locationData.governorate,
                remote: data.locationData.remote,
                branch: data.locationData.branchID
                    ? {
                          connect: {
                              id: data.locationData.branchID
                          }
                      }
                    : undefined,
                deliveryAgentsLocations: data.locationData.deliveryAgentsIDs
                    ? {
                          deleteMany: {
                              locationId: data.locationID,
                              companyId: data.loggedInUser.companyID as number
                          },
                          create: data.locationData.deliveryAgentsIDs?.map((id) => {
                              return {
                                  deliveryAgent: {
                                      connect: {
                                          id: id
                                      }
                                  },
                                  company: {
                                      connect: {
                                          id: data.loggedInUser.companyID as number
                                      }
                                  }
                              };
                          })
                      }
                    : undefined
            },
            select: locationSelect
        });
        return locationReform(location);
    }

    async deleteLocation(data: { locationID: number }) {
        await prisma.location.delete({
            where: {
                id: data.locationID
            }
        });
        return true;
    }

    async publicGetAllLocations() {
        const locations = await prisma.location.findMany({
            select: {
                id: true,
                name: true
            }
        });
        return locations;
    }
}
