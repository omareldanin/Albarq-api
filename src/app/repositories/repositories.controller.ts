import { AdminRole, EmployeeRole } from "@prisma/client";
import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import { BranchesRepository } from "../branches/branches.repository";
import { RepositoryCreateSchema, RepositoryUpdateSchema } from "./repositories.dto";
import { RepositoriesRepository } from "./repositories.repository";

const repositoriesRepository = new RepositoriesRepository();
const branchesRepository = new BranchesRepository();

export class RepositoriesController {
    createRepository = catchAsync(async (req, res) => {
        const repositoryData = RepositoryCreateSchema.parse(req.body);
        const companyID = +res.locals.user.companyID;

        const createdRepository = await repositoriesRepository.createRepository(companyID, repositoryData);

        res.status(200).json({
            status: "success",
            data: createdRepository
        });
    });

    getAllRepositories = catchAsync(async (req, res) => {
        // Filters
        const loggedInUser = res.locals.user as loggedInUserType;
        let companyID: number | undefined;
        if (Object.keys(AdminRole).includes(loggedInUser.role)) {
            companyID = req.query.company_id ? +req.query.company_id : undefined;
        } else if (loggedInUser.companyID) {
            companyID = loggedInUser.companyID;
        }

        const minified = req.query.minified ? req.query.minified === "true" : undefined;

        // Branch manager can only see repositories of his branch
        let branchID = req.query.branch_id ? +req.query.branch_id : undefined;
        if (loggedInUser.role === EmployeeRole.BRANCH_MANAGER) {
            const branch = await branchesRepository.getBranchManagerBranch({
                branchManagerID: loggedInUser.id
            });
            branchID = branch?.id;
        }

        let size = req.query.size ? +req.query.size : 10;
        if (size > 500 && minified !== true) {
            size = 10;
        }

        let page = 1;
        if (req.query.page && !Number.isNaN(+req.query.page) && +req.query.page > 0) {
            page = +req.query.page;
        }

        const { repositories, pagesCount } = await repositoriesRepository.getAllRepositoriesPaginated({
            page: page,
            size: size,
            companyID: companyID,
            branchID: branchID,
            minified: minified
        });

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: repositories
        });
    });

    getRepository = catchAsync(async (req, res) => {
        const repositoryID = +req.params.repositoryID;

        const repository = await repositoriesRepository.getRepository({
            repositoryID: repositoryID
        });

        res.status(200).json({
            status: "success",
            data: repository
        });
    });

    updateRepository = catchAsync(async (req, res) => {
        const repositoryID = +req.params.repositoryID;

        const repositoryData = RepositoryUpdateSchema.parse(req.body);

        const repository = await repositoriesRepository.updateRepository({
            repositoryID: repositoryID,
            repositoryData: repositoryData
        });

        res.status(200).json({
            status: "success",
            data: repository
        });
    });

    deleteRepository = catchAsync(async (req, res) => {
        const repositoryID = +req.params.repositoryID;

        await repositoriesRepository.deleteRepository({
            repositoryID: repositoryID
        });

        res.status(200).json({
            status: "success"
        });
    });
}
