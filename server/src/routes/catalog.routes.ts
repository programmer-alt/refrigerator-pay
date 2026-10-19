import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';

const router = Router();
const catalogController = new CatalogController();

router.get('/', (_req, res) => catalogController.getAllProducts(_req, res));

export default router;
