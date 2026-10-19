import { v4 as uuidv4 } from 'uuid';
import type { CreatePaymentInput, CreatePaymentResponse, OrderStatus } from '../types';
import { OrderService } from './order.service';
import { config } from '../config/env';

export class PaymentService {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService ?? new OrderService();
  }

  /**
   * Создает платежный интент.
   *
   * Adapter pattern: в зависимости от PAYMENT_MODE делегирует
   * либо локальному эмулятору, либо реальному провайдеру (ЮKassa).
   *
   * Для переключения на боевой банк достаточно изменить PAYMENT_MODE=mock
   * на PAYMENT_MODE=yookassa в файле .env
   */
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

    // --- Mock режим: возвращаем URL внутренней страницы оплаты ---
    if (config.paymentMode === 'mock') {
      const mockPaymentId = `mock_payment_${uuidv4()}`;
      await this.orderService.updatePaymentId(orderId, mockPaymentId);

      const paymentUrl = `${config.clientUrl}/payment?orderId=${orderId}`;
      return { confirmationUrl: paymentUrl, orderId };
    }

    // --- Реальный режим: ЮKassa ---
    return await this.createYooKassaPayment(order, idempotencyKey);
  }

  /**
   * Обработка webhook от платежного провайдера.
   * Делегирует обработку в зависимости от режима.
   */
  async handleWebhook(
    eventId: string,
    paymentStatus: string
  ): Promise<{ status: OrderStatus; paymentId: string }> {
    // Для mock-режима webhook не используется — оплата обрабатывается синхронно
    if (config.paymentMode === 'mock') {
      return { status: 'PAID', paymentId: eventId };
    }

    return this.handleYooKassaWebhook(eventId, paymentStatus);
  }

  /**
   * Создание платежа через ЮKassa (боевой режим)
   */
  private async createYooKassaPayment(
    order: { price: string | number; currency: string; title: string; id: string },
    idempotencyKey: string
  ): Promise<CreatePaymentResponse> {
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

    const yookassaData = (await yookassaResponse.json()) as {
      id: string;
      confirmation?: { confirmation_url: string };
    };
    const paymentId = yookassaData.id;
    const confirmationUrl = yookassaData.confirmation?.confirmation_url || '';

    await this.orderService.updatePaymentId(order.id, paymentId);

    return { confirmationUrl, orderId: order.id };
  }

  /**
   * Обработка webhook ЮKassa (боевой режим)
   */
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
}
