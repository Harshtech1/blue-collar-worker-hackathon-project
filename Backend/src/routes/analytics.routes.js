import express from "express";
import { analyzeAreaDensity } from "../controllers/analytics.controller.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/density/:areaId", authorize("admin"), analyzeAreaDensity);

export default router;
