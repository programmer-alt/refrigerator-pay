import { v4 as uuidv4 } from 'uuid';
import type { OrderStatus } from '../types';
import { OrderService } from './order.service';

export interface MockCardInput {
  orderId: string;
  cardLast4: string;
  outcome: 'success' | 'fail';
}

export interface MockPaymentResult {
  success: boolean;
  paymentId: string;
  transactionId: string;
  orderId: string;
  message?: string;
}

export interface ReceiptData {
  orderId: string;
  paymentId: string;
  transactionId: string;
  title: string;
  price: number;
  currency: string;
  cardLast4: string;
  cardHolder: string;
  paymentDate: string;
  status: 'succeeded';
  event: string;
  customerEmail?: string;
}

// TODO: Раскомментировать для отображения банка-эмитента в чеке:
// function detectBank(cardNumber: string): string {
//   const cleaned = cardNumber.replace(/\s|-/g, '');
//   const bin = cleaned.substring(0, 4);
//   const bankMap: Record<string, string> = {
//     '4111': 'SberBank', '5213': 'Tinkoff', '5160': 'VTB',
//     '5469': 'Alfa-Bank', '4276': 'SberBank', '4000': 'Raiffeisen',
//   };
//   return bankMap[bin] || 'MockBank';
// }

/**
 * MockPaymentService — эмулятор платежного шлюза.
 *
 * Используется при PAYMENT_MODE=mock для демонстрации оплаты
 * с вводом карты, валидацией по Луну и имитацией ответа банка.
 */
export class MockPaymentService {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService ?? new OrderService();
  }

  private generateId(): string {
    return uuidv4();
  }

  /**
   * Обрабатывает "оплату" картой (PCI DSS compliant).
   *
   * 🔴 Принимаем только last4 цифры карты и outcome.
   * Полные реквизиты карты НЕ принимаются и НЕ логируются.
   */
  async processPayment(input: MockCardInput): Promise<MockPaymentResult> {
    const { orderId, cardLast4, outcome } = input;

    // Валидация orderId
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Заказ не найден',
      };
    }

    if (order.status !== 'PENDING') {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: `Заказ уже обработан. Статус: ${order.status}`,
      };
    }

    // Валидация last4 (только 4 цифры)
    if (!/^\d{4}$/.test(cardLast4)) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Неверный формат последних 4 цифр карты',
      };
    }

    // --- Имитация задержки банка (2 секунды) ---
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Генерация ID платежа и транзакции
    const paymentId = `mock_pay_${this.generateId()}`;
    const transactionId = `txn_${this.generateId().replace(/-/g, '').substring(0, 16)}`;

    // Обновление заказа
    await this.orderService.updatePaymentId(orderId, paymentId);
    await this.orderService.updateOrderStatus(orderId, outcome === 'success' ? 'PAID' : 'CANCELED');

    return {
      success: outcome === 'success',
      paymentId,
      transactionId,
      orderId,
    };
  }

  /**
   * Формирует данные для чека (🟠 IDOR protection: маскировка персональных данных).
   */
  async getReceipt(orderId: string, cardLast4: string, cardHolder: string): Promise<ReceiptData | null> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order || order.status !== 'PAID') {
      return null;
    }

    // --- 🟠 Маскировка email (первая буква + ***@domain) ---
    const maskedEmail = this.maskEmail(order.customerEmail);

    return {
      orderId: order.id,
      paymentId: order.paymentId || 'N/A',
      transactionId: `txn_${orderId.substring(0, 16)}`,
      title: order.title,
      price: Number(order.price),
      currency: order.currency,
      cardLast4,
      cardHolder: cardHolder || 'VISA',
      paymentDate: order.updatedAt,
      status: 'succeeded',
      event: 'Платёж выполнен',
      customerEmail: maskedEmail,
    };
  }

  /**
   * Маскирует email: v***@mail.ru
   */
  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***@***.***';
    const maskedName = name.charAt(0) + '*'.repeat(Math.max(name.length - 1, 1));
    return `${maskedName}@${domain}`;
  }

  /**
   * Имитация webhook от банка (для внутренней согласованности)
   */
  async simulateWebhook(paymentId: string): Promise<{ status: OrderStatus; paymentId: string }> {
    // Webhook уже обработан в processPayment, но эмулируем для полноты архитектуры
    return { status: 'PAID', paymentId };
  }
}
