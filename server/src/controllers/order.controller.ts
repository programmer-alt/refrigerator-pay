import type { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import type { CreateOrderInput } from '../types';

const orderService = new OrderService();

export class OrderController {
  async createOrder(req: Request, res: Response): Promise<void> {
    const body: CreateOrderInput = req.body;

    if (!body.title || !body.price || !body.customerEmail) {
      res.status(400).json({
        error: 'Missing required fields: title, price, customerEmail',
      });
      return;
    }

    const order = await orderService.createOrder(body);

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
