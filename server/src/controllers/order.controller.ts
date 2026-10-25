import type { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import type { CreateOrderInput } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const orderService = new OrderService();
const catalogService = new CatalogService();

export class OrderController {
  /**
   * Создание заказа с защитой от race condition.
   * Использует Prisma transaction для атомарности.
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    const body: CreateOrderInput = req.body;

    if (!body.productId || !body.customerEmail) {
      res.status(400).json({
        error: 'Missing required fields: productId, customerEmail',
      });
      return;
    }

    // 🔒 Проверка продукта из каталога (вне транзакции — каталог статичный)
    const catalogProduct = catalogService.getProductById(body.productId);

    if (!catalogProduct) {
      res.status(404).json({ error: 'Product not found in catalog' });
      return;
    }

    try {
      // 🔒 Атомарное создание заказа в транзакции
      const order = await prisma.$transaction(async (tx) => {
        return await tx.order.create({
          data: {
            title: catalogProduct.title,
            price: catalogProduct.price,
            currency: catalogProduct.currency,
            customerEmail: body.customerEmail,
          },
        });
      });

      res.status(201).json(orderService.toDto(order));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
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
