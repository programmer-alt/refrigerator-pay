import type { CreatePaymentInput, CreatePaymentResponse, OrderStatus } from '../types';
import { OrderService } from './order.service';
import { config } from '../config/env';

export class PaymentService {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService ?? new OrderService();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse> {
    const { orderId } = input;
    const order = await this.orderService.getOrderById(orderId);

    if (!order) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    if (order.status !== 'PENDING') {
      throw new Error(`Order is not in PENDING status. Current status: ${order.status}`);
    }

    // Mock режим
    if (config.paymentMode === 'mock') {
      const mockPaymentId = `mock_payment_${orderId}_${Date.now()}`;
      await this.orderService.updatePaymentId(orderId, mockPaymentId);
      const paymentUrl = `${config.clientUrl}/payment?orderId=${orderId}`;
      return { confirmationUrl: paymentUrl, orderId };
    }

    // YooKassa режим
    return await this.createYooKassaPayment(order);
  }

  async handleWebhook(
    eventId: string,
    paymentStatus: string
  ): Promise<{ status: OrderStatus; paymentId: string }> {
    if (config.paymentMode === 'mock') {
      return { status: 'PAID', paymentId: eventId };
    }
    return this.handleYooKassaWebhook(eventId, paymentStatus);
  }

  private async createYooKassaPayment(
    order: { price: string | number; currency: string; title: string; id: string }
  ): Promise<CreatePaymentResponse> {
    const idempotencyKey = `idem_${order.id}_${Date.now()}`;

    const yookassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotencyKey,
        'Authorization': `Basic ${Buffer.from(
          `${config.yookassa.shopId}:${config.yookassa.secretKey}`
        ).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: {
          value: Number(order.price).toFixed(2),
          currency: order.currency,
        },
        capture: true,
        description: order.title,
        metadata: {
          order_id: order.id,
        },
        confirmation: {
          type: 'redirect',
          return_url: `${config.clientUrl}/success?orderId=${order.id}`,
        },
      }),
    });

    if (!yookassaResponse.ok) {
      const errorData = await yookassaResponse.json();
      throw new Error(`YooKassa API error: ${JSON.stringify(errorData)}`);
    }

    const yookassaData = await yookassaResponse.json() as {
      id: string;
      confirmation?: { confirmation_url: string };
    };

    await this.orderService.updatePaymentId(order.id, yookassaData.id);

    return {
      confirmationUrl: yookassaData.confirmation?.confirmation_url || '',
      orderId: order.id,
    };
  }

  private async handleYooKassaWebhook(
    eventId: string,
    paymentStatus: string
  ): Promise<{ status: OrderStatus; paymentId: string }> {
    switch (paymentStatus) {
      case 'succeeded':
        return { status: 'PAID', paymentId: eventId };
      case 'canceled':
        return { status: 'CANCELED', paymentId: eventId };
      default:
        throw new Error(`Unknown payment status: ${paymentStatus}`);
    }
  }

  async verifyPaymentWithYooKassa(paymentId: string): Promise<{
    succeeded: boolean;
    amount: { value: string; currency: string };
  }> {
    const yookassaResponse = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${config.yookassa.shopId}:${config.yookassa.secretKey}`
        ).toString('base64')}`,
      },
    });

    if (!yookassaResponse.ok) {
      throw new Error(`Failed to verify payment with YooKassa: ${yookassaResponse.status}`);
    }

    const data = await yookassaResponse.json() as {
      status: string;
      amount: { value: string; currency: string };
    };

    return {
      succeeded: data.status === 'succeeded',
      amount: data.amount,
    };
  }

  async syncPaymentStatus(orderId: string): Promise<{
    status: OrderStatus;
    synced: boolean;
  }> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    if (order.status !== 'PENDING') {
      return { status: order.status, synced: false };
    }

    if (!order.paymentId) {
      return { status: 'PENDING', synced: false };
    }

    try {
      const verification = await this.verifyPaymentWithYooKassa(order.paymentId);
      if (verification.succeeded) {
        await this.orderService.updateOrderStatus(orderId, 'PAID');
        return { status: 'PAID', synced: true };
      }
    } catch {
      // ignore
    }

    return { status: 'PENDING', synced: false };
  }
}
