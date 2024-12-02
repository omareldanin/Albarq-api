import { catchAsync } from "../../lib/catchAsync";
// import type { loggedInUserType } from "../../types/user";
import { CategoryCreateSchema, CategoryUpdateSchema } from "./categories.dto";
import { CategoriesRepository } from "./categories.repository";

const categoriesRepository = new CategoriesRepository();

export class CategoriesController {
    createCategory = catchAsync(async (req, res) => {
        const categoryData = CategoryCreateSchema.parse(req.body);
        // const companyID = +res.locals.user.companyID;

        const createdCategory = await categoriesRepository.createCategory(categoryData);

        res.status(200).json({
            status: "success",
            data: createdCategory
        });
    });

    getAllCategories = catchAsync(async (req, res) => {
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

        const { categories, pagesCount } = await categoriesRepository.getAllCategoriesPaginated({
            page: page,
            size: size,
            // companyID: companyID,
            minified: minified
        });

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: categories
        });
    });

    getCategory = catchAsync(async (req, res) => {
        const categoryID = +req.params.categoryID;

        const category = await categoriesRepository.getCategory({
            categoryID: categoryID
        });

        res.status(200).json({
            status: "success",
            data: category
        });
    });

    updateCategory = catchAsync(async (req, res) => {
        const categoryID = +req.params.categoryID;

        const categoryData = CategoryUpdateSchema.parse(req.body);

        const category = await categoriesRepository.updateCategory({
            categoryID: categoryID,
            categoryData: categoryData
        });

        res.status(200).json({
            status: "success",
            data: category
        });
    });

    deleteCategory = catchAsync(async (req, res) => {
        const categoryID = +req.params.categoryID;

        await categoriesRepository.deleteCategory({
            categoryID: categoryID
        });

        res.status(200).json({
            status: "success"
        });
    });
}
