// import { AdminRole } from "@prisma/client";
import { catchAsync } from "../../lib/catchAsync";
// import type { loggedInUserType } from "../../types/user";
import { SizeCreateSchema, SizeUpdateSchema } from "./sizes.dto";
import { SizesRepository } from "./sizes.repository";

const sizesRepository = new SizesRepository();

export class SizesController {
    createSize = catchAsync(async (req, res) => {
        const sizeData = SizeCreateSchema.parse(req.body);
        // const companyID = +res.locals.user.companyID;

        const createdSize = await sizesRepository.createSize(sizeData);

        res.status(200).json({
            status: "success",
            data: createdSize
        });
    });

    getAllSizes = catchAsync(async (req, res) => {
        // Filters
        // const loggedInUser = res.locals.user as loggedInUserType;
        // let companyID: number | undefined;
        // if (Object.keys(AdminRole).includes(loggedInUser.role)) {
        //     companyID = req.query.company_id ? +req.query.company_id : undefined;
        // } else if (loggedInUser.companyID) {
        //     companyID = loggedInUser.companyID;
        // }

        const minified = req.query.minified ? req.query.minified === "true" : undefined;

        let size = req.query.size ? +req.query.size : 10;
        if (size > 500 && minified !== true) {
            size = 10;
        }
        let page = 1;
        if (req.query.page && !Number.isNaN(+req.query.page) && +req.query.page > 0) {
            page = +req.query.page;
        }

        const { sizes, pagesCount } = await sizesRepository.getAllSizesPaginated({
            page: page,
            size: size,
            // companyID: companyID,
            minified: minified
        });

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: sizes
        });
    });

    getSize = catchAsync(async (req, res) => {
        const sizeID = +req.params.sizeID;

        const size = await sizesRepository.getSize({
            sizeID: sizeID
        });

        res.status(200).json({
            status: "success",
            data: size
        });
    });

    updateSize = catchAsync(async (req, res) => {
        const sizeID = +req.params.sizeID;

        const sizeData = SizeUpdateSchema.parse(req.body);

        const size = await sizesRepository.updateSize({
            sizeID: sizeID,
            sizeData: sizeData
        });

        res.status(200).json({
            status: "success",
            data: size
        });
    });

    deleteSize = catchAsync(async (req, res) => {
        const sizeID = +req.params.sizeID;

        await sizesRepository.deleteSize({
            sizeID: sizeID
        });

        res.status(200).json({
            status: "success"
        });
    });
}
