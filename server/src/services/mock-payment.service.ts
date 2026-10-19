import { v4 as uuidv4 } from 'uuid';
import type { OrderStatus } from '../types';
import { OrderService } from './order.service';

export interface MockCardInput {
  orderId: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardHolder: string;
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
}

/**
 * Валидация номера карты по алгоритму Луна
 */
function luhnCheck(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s|-/g, '');
  if (cleaned.length < 13 || cleaned.length > 19 || !/^\d+$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
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

  /**
   * Обрабатывает "оплату" картой:
   * - Валидирует номер карты (Luhn)
   * - Проверяет срок действия
   * - Имитирует задержку банка (2 сек)
   * - Обновляет статус заказа на PAID
   */
  async processPayment(input: MockCardInput): Promise<MockPaymentResult> {
    const { orderId, cardNumber, expiryMonth, expiryYear, cvv, cardHolder } = input;

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

    // Валидация номера карты
    const cleanedCard = cardNumber.replace(/\s|-/g, '');
    if (!luhnCheck(cleanedCard)) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Неверный номер карты. Проверьте по алгоритму Луна.',
      };
    }

    // Валидация срока действия
    const month = parseInt(expiryMonth, 10);
    const year = parseInt(`20${expiryYear}`, 10);

    if (month < 1 || month > 12) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Неверный месяц окончания карты',
      };
    }

    const now = new Date();
    const expiry = new Date(year, month);
    if (expiry <= now) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Карта просрочена',
      };
    }

    // Валидация CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Неверный CVV код',
      };
    }

    // Валидация владельца карты
    if (cardHolder.trim().length < 2) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Введите имя владельца карты',
      };
    }

    // --- Имитация задержки банка (2 секунды) ---
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Генерация ID платежа и транзакции
    const paymentId = `mock_pay_${uuidv4()}`;
    const transactionId = `txn_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    // Обновление заказа
    await this.orderService.updatePaymentId(orderId, paymentId);
    await this.orderService.updateOrderStatus(orderId, 'PAID');

    return {
      success: true,
      paymentId,
      transactionId,
      orderId,
    };
  }

  /**
   * Формирует данные для чека
   */
  async getReceipt(orderId: string, cardLast4: string, cardHolder: string): Promise<ReceiptData | null> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order || order.status !== 'PAID') {
      return null;
    }

    return {
      orderId: order.id,
      paymentId: order.paymentId || 'N/A',
      transactionId: `txn_${orderId.substring(0, 16)}`,
      title: order.title,
      price: Number(order.price),
      currency: order.currency,
      cardLast4,
      cardHolder,
      paymentDate: order.updatedAt,
      status: 'succeeded',
      event: 'Платёж выполнен',
    };
  }

  /**
   * Имитация webhook от банка (для внутренней согласованности)
   */
  async simulateWebhook(paymentId: string): Promise<{ status: OrderStatus; paymentId: string }> {
    // Webhook уже обработан в processPayment, но эмулируем для полноты архитектуры
    return { status: 'PAID', paymentId };
  }
}
