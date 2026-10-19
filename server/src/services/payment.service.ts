import { v4 as uuidv4 } from 'uuid';
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

    const idempotencyKey = uuidv4();

    await this.orderService.updateIdempotencyKey(orderId, idempotencyKey);

    // ============================================================
    // TODO: Интеграция с ЮKassa
    // ============================================================
    //
    // Раскомментируйте и заполните код ниже для реальной интеграции:
    //
    // const yookassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Idempotence-Key': idempotencyKey,
    //     'Authorization': `Basic ${Buffer.from(
    //       `${config.yookassa.shopId}:${config.yookassa.secretKey}`
    //     ).toString('base64')}`,
    //   },
    //   body: JSON.stringify({
    //     amount: {
    //       value: order.price.toFixed(2),
    //       currency: order.currency,
    //     },
    //     capture: true,
    //     description: order.title,
    //     metadata: {
    //       order_id: orderId,
    //     },
    //     confirmation: {
    //       type: 'redirect',
    //       return_url: `${config.clientUrl}/success?orderId=${orderId}`,
    //     },
    //   }),
    // });
    //
    // if (!yookassaResponse.ok) {
    //   const errorData = await yookassaResponse.json();
    //   throw new Error(`YooKassa API error: ${JSON.stringify(errorData)}`);
    // }
    //
    // const yookassaData = await yookassaResponse.json();
    // const paymentId = yookassaData.id;
    // const confirmationUrl = yookassaData.confirmation?.url;
    //
    // await this.orderService.updatePaymentId(orderId, paymentId);
    //
    // return { confirmationUrl, orderId };
    // ============================================================

    // --- Mock response для локальной разработки ---
    const mockPaymentId = `mock_payment_${uuidv4()}`;
    await this.orderService.updatePaymentId(orderId, mockPaymentId);

    const confirmationUrl = `${config.clientUrl}/success?orderId=${orderId}`;

    return { confirmationUrl, orderId };
  }

  async handleWebhook(
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
}
