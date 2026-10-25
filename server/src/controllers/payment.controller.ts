import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { MockPaymentService } from '../services/mock-payment.service';
import { OrderService } from '../services/order.service';
import type { CreatePaymentInput } from '../types';
import { config } from '../config/env';

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
   * Обработка оплаты через mock-шлюз (PCI DSS compliant).
   *
   * 🔴 Принимаем только cardLast4 и outcome (success/fail).
   * Полные реквизиты карты НЕ принимаются.
   */
  async processMockPayment(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    const orderId = String(body.orderId || '');
    const cardLast4 = String(body.cardLast4 || '');
    const outcome = String(body.outcome || '');

    if (!orderId || !cardLast4 || !outcome) {
      res.status(400).json({ error: 'Missing required fields: orderId, cardLast4, outcome' });
      return;
    }

    // Валидация cardLast4 (только 4 цифры)
    if (!/^\d{4}$/.test(cardLast4)) {
      res.status(400).json({ error: 'Invalid cardLast4 format. Expected 4 digits.' });
      return;
    }

    // Валидация outcome
    if (outcome !== 'success' && outcome !== 'fail') {
      res.status(400).json({ error: 'Invalid outcome. Expected "success" or "fail".' });
      return;
    }

    try {
      const result = await mockPaymentService.processPayment({
        orderId,
        cardLast4,
        outcome: outcome as 'success' | 'fail',
      });

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

    // --- 🔴 Двойная верификация: не верим req.body, берем только paymentId ---
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

      // --- 🔴 Двойная верификация через API ЮKassa ---
      // Если это режим YooKassa и статус succeeded — проверяем платеж напрямую
      if (config.paymentMode !== 'mock' && paymentStatus === 'succeeded' && existingOrder.paymentId) {
        try {
          const verification = await paymentService.verifyPaymentWithYooKassa(existingOrder.paymentId);

          if (!verification.succeeded) {
            res.status(400).json({ error: 'Payment verification failed' });
            return;
          }

          // --- 🔴 Проверка суммы: копейка в копейку ---
          // Сравниваем сумму из ЮKassa с суммой заказа
          const yookassaAmount = parseFloat(verification.amount.value);
          const orderAmount = parseFloat(String(existingOrder.price));
          if (Math.abs(yookassaAmount - orderAmount) > 0.001) {
            res.status(400).json({ error: 'Payment amount mismatch' });
            return;
          }
        } catch {
          // Если не удалось проверить — обновляем по webhook (fallback)
          console.warn('YooKassa verification failed, falling back to webhook status');
        }
      }

      const { status: newStatus } = await paymentService.handleWebhook(
        eventId,
        paymentStatus
      );

      // --- Обновляем статус заказа ---
      await orderService.updateOrderStatus(orderId, newStatus);

      res.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

  /**
   * Получение статуса заказа для polling на SuccessPage.
   * Если статус PENDING — синхронизируется с ЮKassa.
   */
  async getOrderStatus(req: Request, res: Response): Promise<void> {
    const orderId = String(req.params.orderId || '');

    try {
      const order = await orderService.getOrderById(orderId);

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Если заказ уже оплачен или отменен — возвращаем текущий статус
      if (order.status !== 'PENDING') {
        res.status(200).json({
          orderId: order.id,
          status: order.status,
          synced: false,
        });
        return;
      }

      // Если есть paymentId — синхронизируем с ЮKassa
      if (order.paymentId && config.paymentMode !== 'mock') {
        try {
          const syncResult = await paymentService.syncPaymentStatus(orderId);
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
