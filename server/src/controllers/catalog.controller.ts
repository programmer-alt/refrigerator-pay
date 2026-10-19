import type { Request, Response } from 'express';
import { CatalogService } from '../services/catalog.service';

const catalogService = new CatalogService();

export class CatalogController {
  getAllProducts(_req: Request, res: Response): void {
    const products = catalogService.getAllProducts();
    res.status(200).json(products);
  }
}
