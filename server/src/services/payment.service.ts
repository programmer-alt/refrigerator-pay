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

    // --- Idempotency: если у заказа уже есть активный платеж — возвращаем существующий ---
    if (order.paymentId && order.status === 'PENDING') {
      if (config.paymentMode === 'mock') {
        const paymentUrl = `${config.clientUrl}/payment?orderId=${orderId}`;
        return { confirmationUrl: paymentUrl, orderId };
      }
      // Для YooKassa: если paymentId уже установлен, это означает что платеж уже создан
      // Возвращаем тот же paymentId (создадим новый intent для получения confirmation URL)
    }

    const idempotencyKey = order.idempotencyKey ?? this.generateIdempotencyKey(orderId);
    if (!order.idempotencyKey) {
      await this.orderService.updateIdempotencyKey(orderId, idempotencyKey);
    }

    // --- Mock режим: возвращаем URL внутренней страницы оплаты ---
    if (config.paymentMode === 'mock') {
      const mockPaymentId = order.paymentId ?? `mock_payment_${this.generateIdempotencyKey(orderId)}`;
      if (!order.paymentId) {
        await this.orderService.updatePaymentId(orderId, mockPaymentId);
      }

      const paymentUrl = `${config.clientUrl}/payment?orderId=${orderId}`;
      return { confirmationUrl: paymentUrl, orderId };
    }

    // --- Реальный режим: ЮKassa ---
    return await this.createYooKassaPayment(order, idempotencyKey);
  }

  /**
   * Генерирует idempotency key, привязанный к order.id
   */
  private generateIdempotencyKey(orderId: string): string {
    // В продакшене здесь будет crypto.randomUUID()
    return `idem_${orderId}_${Date.now()}`;
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

  /**
   * 🔴 Двойная верификация платежа через API ЮKassa.
   * Используется в webhook handler для подтверждения оплаты.
   */
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

    const data = (await yookassaResponse.json()) as {
      status: string;
      amount: { value: string; currency: string };
    };

    return {
      succeeded: data.status === 'succeeded',
      amount: data.amount,
    };
  }

  /**
   * Синхронизация статуса платежа с ЮKassa (для polling на SuccessPage).
   * Если заказ PENDING, но в ЮKassa уже succeeded — обновляем статус.
   */
  async syncPaymentStatus(orderId: string): Promise<{
    status: OrderStatus;
    synced: boolean;
  }> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    // Если заказ уже оплачен или отменен — ничего не делаем
    if (order.status !== 'PENDING') {
      return { status: order.status, synced: false };
    }

    // Если нет paymentId — нечего синхронизировать
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
      // Если не удалось синхронизировать — возвращаем текущий статус
    }

    return { status: 'PENDING', synced: false };
  }
}
