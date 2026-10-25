import { PrismaClient } from '@prisma/client';
import type { OrderDto, OrderStatus } from '../types';

const prisma = new PrismaClient();

interface OrderCreateData {
  title: string;
  price: number;
  currency: string;
  customerEmail: string;
}

export class OrderService {
  async createOrder(data: OrderCreateData): Promise<OrderDto> {
    const order = await prisma.order.create({
      data: {
        title: data.title,
        price: data.price,
        currency: data.currency,
        customerEmail: data.customerEmail,
      },
    });

    return this.toDto(order);
  }

  async getOrderById(id: string): Promise<OrderDto | null> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return null;
    }

    return this.toDto(order);
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderDto | null> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    return this.toDto(order);
  }

  async updatePaymentId(orderId: string, paymentId: string): Promise<OrderDto | null> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentId },
    });

    return this.toDto(order);
  }

  async updateIdempotencyKey(
    orderId: string,
    idempotencyKey: string
  ): Promise<OrderDto | null> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { idempotencyKey },
    });

    return this.toDto(order);
  }

  /**
   * Конвертирует сырую запись Order в OrderDto.
   * Публичный для использования в контроллерах.
   */
  toDto(order: {
    id: string;
    title: string;
    price: unknown;
    currency: string;
    status: OrderStatus;
    customerEmail: string;
    paymentId: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OrderDto {
    return {
      id: order.id,
      title: order.title,
      price: Number(order.price),
      currency: order.currency,
      status: order.status,
      customerEmail: order.customerEmail,
      paymentId: order.paymentId,
      idempotencyKey: order.idempotencyKey,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
