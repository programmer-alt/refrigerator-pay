import type { OrderDto, OrderStatus } from '../types';

interface OrderCreateData {
  title: string;
  price: number;
  currency: string;
  customerEmail: string;
}

/**
 * OrderService — in-memory хранилище заказов.
 *
 * Использует Map для хранения заказов в оперативной памяти.
 * Данные не сохраняются между перезапусками сервера.
 * Подходит для демо и тестирования без внешней БД.
 */
export class OrderService {
  private orders = new Map<string, OrderDto>();

  async createOrder(data: OrderCreateData): Promise<OrderDto> {
    const order: OrderDto = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: data.title,
      price: data.price,
      currency: data.currency,
      status: 'PENDING',
      customerEmail: data.customerEmail,
      paymentId: null,
      idempotencyKey: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async getOrderById(id: string): Promise<OrderDto | null> {
    return this.orders.get(id) ?? null;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    const updated: OrderDto = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    return updated;
  }

  async updatePaymentId(orderId: string, paymentId: string): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    const updated: OrderDto = {
      ...order,
      paymentId,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    return updated;
  }

  async updateIdempotencyKey(
    orderId: string,
    idempotencyKey: string
  ): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    const updated: OrderDto = {
      ...order,
      idempotencyKey,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    return updated;
  }
}
