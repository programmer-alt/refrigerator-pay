import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { MockPaymentService } from '../services/mock-payment.service';
import { OrderService } from '../services/order.service';
import type { CreatePaymentInput, MockPaymentInput } from '../types';

const paymentService = new PaymentService();
const mockPaymentService = new MockPaymentService();
const orderService = new OrderService();

export class PaymentController {
  async createPaymentIntent(req: Request, res: Response): Promise<void> {
    const body: CreatePaymentInput = req.body;

    if (!body.orderId) {
      res.status(400).json({ error: 'Missing required field: orderId' });
      return;
    }

    try {
      const payment = await paymentService.createPayment(body);
      res.status(200).json(payment);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

  /**
   * Обработка оплаты через mock-шлюз (ввод карты → ответ банка)
   */
  async processMockPayment(req: Request, res: Response): Promise<void> {
    const body: MockPaymentInput = req.body;

    const { orderId, cardNumber, expiryMonth, expiryYear, cvv, cardHolder } = body;

    if (!orderId || !cardNumber || !expiryMonth || !expiryYear || !cvv || !cardHolder) {
      res.status(400).json({ error: 'Missing required card fields' });
      return;
    }

    try {
      const result = await mockPaymentService.processPayment(body);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        orderId: result.orderId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  }

  /**
   * Получение данных чека после успешной оплаты
   */
  async getReceipt(req: Request, res: Response): Promise<void> {
    const orderId = String(req.params.orderId || '');
    const { cardLast4 = '0000', cardHolder = '' } = req.query as Record<string, string>;

    try {
      const receipt = await mockPaymentService.getReceipt(orderId, cardLast4, cardHolder);

      if (!receipt) {
        res.status(404).json({ error: 'Receipt not found or payment not completed' });
        return;
      }

      res.status(200).json(receipt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    // req.body — Buffer (raw body из express.raw())
    const rawBody = req.body as Buffer;
    const rawString = rawBody.toString('utf-8');

    // --- Верификация подписи ЮKassa через Content-MD5 ---
    const contentMd5 = req.headers['content-md5'] as string | undefined;

    if (contentMd5) {
      const computedMd5 = crypto.createHash('md5').update(rawBody).digest('base64');
      if (computedMd5 !== contentMd5) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    // --- Парсинг тела ---
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawString);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const eventId: string = String(parsedBody.id || '');
    const paymentStatus: string = String(parsedBody.status || '');
    const metadata: Record<string, string> = (parsedBody.metadata as Record<string, string>) || {};
    const orderId: string = metadata.order_id || '';

    if (!eventId || !paymentStatus) {
      res.status(400).json({ error: 'Missing eventId or paymentStatus' });
      return;
    }

    if (!orderId) {
      res.status(400).json({ error: 'Missing order_id in webhook metadata' });
      return;
    }

    try {
      const { status: newStatus } = await paymentService.handleWebhook(
        eventId,
        paymentStatus
      );

      // --- Защита от дубликатов: проверяем текущий статус ---
      const existingOrder = await orderService.getOrderById(orderId);

      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      if (existingOrder.status === 'PAID' || existingOrder.status === 'CANCELED') {
        // Статус уже установлен — игнорируем дублирующий webhook
        res.status(200).json({ received: true, skipped: true });
        return;
      }

      // --- Обновляем статус заказа ---
      await orderService.updateOrderStatus(orderId, newStatus);

      res.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }
}
