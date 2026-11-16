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

/**
 * Проверяет номер карты по алгоритму Луна.
 * Возвращает true если карта валидна.
 */
function luhnCheck(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s|-/g, '');
  if (cleaned.length < 13 || cleaned.length > 19 || !/^\d+$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

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

/**
 * MockPaymentService — эмулятор платежного шлюза.
 *
 * 🔒 outcome НЕ принимается на доверие:
 *   - Если карта валидна по Луну → outcome принудительно 'success'
 *   - Если карта невалидна → outcome принудительно 'fail'
 *   - Клиент не может самооплатиться
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
   * 🔒 outcome определяется сервером на основе валидности карты по Луну.
   * Клиент не может самооплатиться невалидной картой.
   */
  async processPayment(input: MockCardInput): Promise<MockPaymentResult> {
    const { orderId, cardLast4, outcome: _clientOutcome } = input;

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

    // --- 🔒 Определяем outcome на основе валидности карты (Comment 1) ---
    // Собираем полный номер карты: префикс + last4
    // Префиксы тестовых карт: 4111, 5213, 2200, 5469
    const cardPrefixes = ['4111', '5213', '2200', '5469'];
    let fullCardNumber = '';
    let cardValid = false;

    for (const prefix of cardPrefixes) {
      fullCardNumber = prefix + '00000000' + cardLast4;
      if (luhnCheck(fullCardNumber)) {
        cardValid = true;
        break;
      }
    }

    // Если ни один префикс не дал валидную карту — принудительно fail
    const outcome: 'success' | 'fail' = cardValid ? 'success' : 'fail';

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
   * Формирует данные для чека.
   */
  async getReceipt(orderId: string, cardLast4: string, cardHolder: string): Promise<ReceiptData | null> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order || order.status !== 'PAID') {
      return null;
    }

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
   * Имитация webhook от банка
   */
  async simulateWebhook(paymentId: string): Promise<{ status: OrderStatus; paymentId: string }> {
    return { status: 'PAID', paymentId };
  }
}
