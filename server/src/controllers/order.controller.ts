import type { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import type { CreateOrderInput } from '../types';

const orderService = new OrderService();
const catalogService = new CatalogService();

export class OrderController {
  async createOrder(req: Request, res: Response): Promise<void> {
    const body: CreateOrderInput = req.body;

    if (!body.productId || !body.customerEmail) {
      res.status(400).json({
        error: 'Missing required fields: productId, customerEmail',
      });
      return;
    }

    const product = catalogService.getProductById(body.productId);

    if (!product) {
      res.status(404).json({ error: 'Product not found in catalog' });
      return;
    }

    const order = await orderService.createOrder({
      title: product.title,
      price: product.price,
      currency: product.currency,
      customerEmail: body.customerEmail,
    });

    res.status(201).json(order);
  }

  async getOrderById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;

    const order = await orderService.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(order);
  }
}
