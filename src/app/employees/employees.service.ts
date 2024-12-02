import { AdminRole, EmployeeRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { env } from "../../config";
import { AppError } from "../../lib/AppError";
import type { loggedInUserType } from "../../types/user";
import { BranchesRepository } from "../branches/branches.repository";
import { sendNotification } from "../notifications/helpers/sendNotification";
import type { EmployeeCreateType, EmployeeUpdateType, EmployeesFiltersType } from "./employees.dto";
import { EmployeesRepository } from "./employees.repository";

const employeesRepository = new EmployeesRepository();
const branchesRepository = new BranchesRepository();

export class EmployeesService {
    createEmployee = async (data: {
        loggedInUser: loggedInUserType;
        employeeData: EmployeeCreateType;
    }) => {
        let companyID = data.loggedInUser.companyID as number;
        if (
            !data.loggedInUser.companyID &&
            (data.loggedInUser.role === AdminRole.ADMIN ||
                data.loggedInUser.role === AdminRole.ADMIN_ASSISTANT)
        ) {
            companyID = data.employeeData.companyID as number;
        }

        if (
            data.employeeData.role !== EmployeeRole.DELIVERY_AGENT &&
            data.loggedInUser.role !== EmployeeRole.COMPANY_MANAGER &&
            data.loggedInUser.role !== AdminRole.ADMIN &&
            data.loggedInUser.role !== AdminRole.ADMIN_ASSISTANT
        ) {
            throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
        }

        const hashedPassword = bcrypt.hashSync(
            data.employeeData.password + (env.PASSWORD_SALT as string),
            12
        );

        const createdEmployee = await employeesRepository.createEmployee({
            companyID,
            loggedInUser: data.loggedInUser,
            employeeData: {
                ...data.employeeData,
                password: hashedPassword
            }
        });

        return createdEmployee;
    };

    getAllEmployees = async (data: {
        filters: EmployeesFiltersType;
        loggedInUser: loggedInUserType;
    }) => {
        let companyID: number | undefined;
        if (Object.keys(AdminRole).includes(data.loggedInUser.role)) {
            companyID = data.filters.companyID;
        } else if (data.loggedInUser.companyID) {
            companyID = data.loggedInUser.companyID;
        }

        // Only show delivery agents from the branch of the logged in branch manager
        let branchID: number | undefined;
        let role: EmployeeRole | undefined;
        if (data.loggedInUser.role === EmployeeRole.BRANCH_MANAGER) {
            const branch = await branchesRepository.getBranchManagerBranch({
                branchManagerID: data.loggedInUser.id
            });
            branchID = branch?.id;
            role = EmployeeRole.DELIVERY_AGENT;
        } else {
            branchID = data.filters.branchID;
        }

        const { employees, pagesCount } = await employeesRepository.getAllEmployeesPaginated({
            filters: { ...data.filters, companyID, branchID, role }
        });

        return { employees, pagesCount };
    };

    getEmployee = async (data: {
        params: {
            employeeID: number;
        };
    }) => {
        const employee = await employeesRepository.getEmployee({
            employeeID: data.params.employeeID
        });

        return employee;
    };

    updateEmployee = async (data: {
        params: {
            employeeID: number;
        };
        employeeData: EmployeeUpdateType;
    }) => {
        const oldEmployee = await employeesRepository.getEmployee({
            employeeID: data.params.employeeID
        });

        if (data.employeeData.password) {
            const hashedPassword = bcrypt.hashSync(
                data.employeeData.password + (env.PASSWORD_SALT as string),
                12
            );
            data.employeeData.password = hashedPassword;
        }

        const updatedEmployee = await employeesRepository.updateEmployee({
            employeeID: data.params.employeeID,
            // companyID: companyID,
            employeeData: data.employeeData
        });

        // Send notification to the company manager if the delviery agent name is updated
        if (
            data.employeeData.name &&
            (updatedEmployee?.role === "DELIVERY_AGENT" || updatedEmployee?.role === "RECEIVING_AGENT") &&
            oldEmployee?.name !== updatedEmployee?.name
        ) {
            // get the company manager id
            const companyManager = await employeesRepository.getCompanyManager({
                companyID: updatedEmployee.company.id
            });

            await sendNotification({
                userID: companyManager?.id as number,
                title: "تغيير اسم مندوب",
                content: `تم تغيير اسم المندوب ${oldEmployee?.name} إلى ${updatedEmployee?.name}`
            });
        }

        return updatedEmployee;
    };

    deleteEmployee = async (data: {
        params: {
            employeeID: number;
        };
    }) => {
        await employeesRepository.deleteEmployee({
            employeeID: data.params.employeeID
        });
    };

    deactivateEmployee = async (data: {
        params: {
            employeeID: number;
        };
        loggedInUser: loggedInUserType;
    }) => {
        await employeesRepository.deactivateEmployee({
            employeeID: data.params.employeeID,
            deletedByID: data.loggedInUser.id
        });
    };

    reactivateEmployee = async (data: {
        params: {
            employeeID: number;
        };
    }) => {
        await employeesRepository.reactivateEmployee({
            employeeID: data.params.employeeID
        });
    };
}
