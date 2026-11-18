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

export class MockPaymentService {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService ?? new OrderService();
  }

  private generateId(): string {
    return uuidv4();
  }

  async processPayment(input: MockCardInput): Promise<MockPaymentResult> {
    const { orderId, cardLast4, outcome } = input;

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

    if (!/^\d{4}$/.test(cardLast4)) {
      return {
        success: false,
        paymentId: '',
        transactionId: '',
        orderId,
        message: 'Неверный формат последних 4 цифр карты',
      };
    }

    // Имитация задержки банка
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const paymentId = `mock_pay_${this.generateId()}`;
    const transactionId = `txn_${this.generateId().replace(/-/g, '').substring(0, 16)}`;

    await this.orderService.updatePaymentId(orderId, paymentId);
    await this.orderService.updateOrderStatus(orderId, outcome === 'success' ? 'PAID' : 'CANCELED');

    return {
      success: outcome === 'success',
      paymentId,
      transactionId,
      orderId,
    };
  }

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

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***@***.***';
    const maskedName = name.charAt(0) + '*'.repeat(Math.max(name.length - 1, 1));
    return `${maskedName}@${domain}`;
  }

  async simulateWebhook(paymentId: string): Promise<{ status: OrderStatus; paymentId: string }> {
    return { status: 'PAID', paymentId };
  }
}
