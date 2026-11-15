import type { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import { createOrderInputSchema, validate } from '../validators';

const orderService = new OrderService();
const catalogService = new CatalogService();

export class OrderController {
  /**
   * Создание заказа с Zod-валидацией.
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    // 🔴 Zod-валидация вместо ручных проверок
    const validation = validate(createOrderInputSchema, req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { productId, customerEmail } = validation.data;

    // 🔒 Проверка продукта из каталога (вне транзакции — каталог статичный)
    const catalogProduct = catalogService.getProductById(productId);

    if (!catalogProduct) {
      res.status(404).json({ error: 'Product not found in catalog' });
      return;
    }

    try {
      // Создание заказа через OrderService (in-memory)
      const order = await orderService.createOrder({
        title: catalogProduct.title,
        price: catalogProduct.price,
        currency: catalogProduct.currency,
        customerEmail,
      });

      res.status(201).json(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

  async getOrderById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;

    if (!id || id.length === 0) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }

    const order = await orderService.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(order);
  }
}
