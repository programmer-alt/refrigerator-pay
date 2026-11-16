import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { MockPaymentService } from '../services/mock-payment.service';
import { OrderService } from '../services/order.service';
import { createPaymentInputSchema, mockPaymentInputSchema, validate } from '../validators';
import { config } from '../config/env';

/**
 * Error codes for controller error handling.
 */
enum ErrorCode {
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  UNKNOWN = 'UNKNOWN',
}

export class PaymentController {
  private paymentService: PaymentService;
  private mockPaymentService: MockPaymentService;
  private orderService: OrderService;

  constructor(sharedOrderService?: OrderService, paymentService?: PaymentService, mockPaymentService?: MockPaymentService) {
    this.orderService = sharedOrderService ?? new OrderService();
    this.paymentService = paymentService ?? new PaymentService(this.orderService);
    this.mockPaymentService = mockPaymentService ?? new MockPaymentService(this.orderService);
  }

  /**
   * Map error to HTTP status code.
   * Storage failures → 500, validation → 400, etc.
   */
  private errorToStatus(error: unknown): { status: number; code: ErrorCode } {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('persist') || msg.includes('disk') || msg.includes('failed to')) {
        return { status: 500, code: ErrorCode.STORAGE_FAILURE };
      }
      if (msg.includes('not found')) {
        return { status: 404, code: ErrorCode.NOT_FOUND };
      }
      if (msg.includes('store full') || msg.includes('evict')) {
        return { status: 503, code: ErrorCode.BAD_REQUEST };
      }
    }
    return { status: 400, code: ErrorCode.UNKNOWN };
  }

  async createPaymentIntent(req: Request, res: Response): Promise<void> {
    const validation = validate(createPaymentInputSchema, req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const payment = await this.paymentService.createPayment(validation.data);
      res.status(200).json(payment);
    } catch (error) {
      const { status, code } = this.errorToStatus(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(status).json({ error: message, code });
    }
  }

  /**
   * Обработка оплаты через mock-шлюз (demo only).
   *
   * 🔒 outcome: 'success' НЕ принимается на доверие — сервер проверяет карту по Луну.
   */
  async processMockPayment(req: Request, res: Response): Promise<void> {
    const validation = validate(mockPaymentInputSchema, req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const result = await this.mockPaymentService.processPayment(validation.data);

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
      const receipt = await this.mockPaymentService.getReceipt(orderId, cardLast4, cardHolder);

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

  /**
   * Webhook handler с монотонными переходами статусов (Comment 3).
   *
   * 🔒 Монотонность:
   *   - PAID → только PAID (игнорируем canceled)
   *   - CANCELED → только CANCELED (игнорируем succeeded)
   *   - PENDING → PAID | CANCELED
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
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
      // --- Читаем текущий статус ---
      const existingOrder = await this.orderService.getOrderById(orderId);

      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // --- Монотонные переходы статусов (Comment 3) ---
      // Если заказ уже в терминальном статусе — игнорируем
      if (existingOrder.status === 'PAID' || existingOrder.status === 'CANCELED') {
        // Проверяем, не пытаемся ли мы перейти "назад"
        if (
          (existingOrder.status === 'PAID' && paymentStatus === 'canceled') ||
          (existingOrder.status === 'CANCELED' && paymentStatus === 'succeeded')
        ) {
          // Попытка отменить оплаченный или оплатить отмененный — игнорируем
          console.warn(`⚠️ Ignored monotonicity violation: order ${orderId} is ${existingOrder.status}, webhook says ${paymentStatus}`);
          res.status(200).json({ received: true, skipped: true, reason: 'monotonicity' });
          return;
        }
        // Тот же терминальный статус — дубликат
        res.status(200).json({ received: true, skipped: true });
        return;
      }

      // --- Двойная верификация через API ЮKassa ---
      if (config.paymentMode !== 'mock' && paymentStatus === 'succeeded' && existingOrder.paymentId) {
        try {
          const verification = await this.paymentService.verifyPaymentWithYooKassa(existingOrder.paymentId);

          if (!verification.succeeded) {
            res.status(400).json({ error: 'Payment verification failed' });
            return;
          }

          // Сверка суммы
          const yookassaAmount = parseFloat(verification.amount.value);
          const orderAmount = parseFloat(String(existingOrder.price));
          if (Math.abs(yookassaAmount - orderAmount) > 0.001) {
            res.status(400).json({ error: 'Payment amount mismatch' });
            return;
          }
        } catch {
          console.warn('YooKassa verification failed, falling back to webhook status');
        }
      }

      // --- Определяем новый статус ---
      const { status: newStatus } = await this.paymentService.handleWebhook(
        eventId,
        paymentStatus
      );

      // --- Обновляем статус заказа (транзакционно, монотонно) ---
      await this.orderService.updateOrderStatus(orderId, newStatus);

      res.status(200).json({ received: true });
    } catch (error) {
      const { status, code } = this.errorToStatus(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(status).json({ error: message, code });
    }
  }

  /**
   * Получение статуса заказа для polling на SuccessPage.
   */
  async getOrderStatus(req: Request, res: Response): Promise<void> {
    const orderId = String(req.params.orderId || '');

    try {
      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      if (order.status !== 'PENDING') {
        res.status(200).json({
          orderId: order.id,
          status: order.status,
          synced: false,
        });
        return;
      }

      if (order.paymentId && config.paymentMode !== 'mock') {
        try {
          const syncResult = await this.paymentService.syncPaymentStatus(orderId);
          res.status(200).json({
            orderId: order.id,
            status: syncResult.status,
            synced: syncResult.synced,
          });
          return;
        } catch {
          // Если не удалось синхронизировать — возвращаем текущий статус
        }
      }

      res.status(200).json({
        orderId: order.id,
        status: order.status,
        synced: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  }
}
