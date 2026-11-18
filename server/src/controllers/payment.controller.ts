import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { MockPaymentService } from '../services/mock-payment.service';
import { OrderService } from '../services/order.service';
import { createPaymentInputSchema, mockPaymentInputSchema, validate } from '../validators';
import { config } from '../config/env';

export class PaymentController {
  private paymentService: PaymentService;
  private mockPaymentService: MockPaymentService;
  private orderService: OrderService;

  constructor(sharedOrderService?: OrderService, paymentService?: PaymentService, mockPaymentService?: MockPaymentService) {
    this.orderService = sharedOrderService ?? new OrderService();
    this.paymentService = paymentService ?? new PaymentService(this.orderService);
    this.mockPaymentService = mockPaymentService ?? new MockPaymentService(this.orderService);
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

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

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const rawBody = req.body as Buffer;
    const rawString = rawBody.toString('utf-8');

    const contentMd5 = req.headers['content-md5'] as string | undefined;

    if (contentMd5) {
      const computedMd5 = crypto.createHash('md5').update(rawBody).digest('base64');
      if (computedMd5 !== contentMd5) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

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
      const existingOrder = await this.orderService.getOrderById(orderId);

      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      const { status: newStatus } = await this.paymentService.handleWebhook(
        eventId,
        paymentStatus
      );

      await this.orderService.updateOrderStatus(orderId, newStatus);

      res.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

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
          // ignore
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
