import { Router, type IRouter } from "express";
import growthRouter from "./growth";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(growthRouter);

export default router;
