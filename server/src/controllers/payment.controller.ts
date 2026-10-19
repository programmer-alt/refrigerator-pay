import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import type { CreatePaymentInput } from '../types';

const paymentService = new PaymentService();

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

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body;

    const eventId: string = body.id || '';
    const paymentStatus: string = body.status || '';

    if (!eventId || !paymentStatus) {
      res.status(400).json({ error: 'Missing eventId or paymentStatus' });
      return;
    }

    try {
      const { status: _newStatus } = await paymentService.handleWebhook(
        eventId,
        paymentStatus
      );

      // TODO: Извлечь orderId из metadata события ЮKassa
      // const orderId: string = body.metadata?.order_id || '';
      // if (orderId) {
      //   await orderService.updateOrderStatus(orderId, newStatus);
      // }

      res.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }
}
