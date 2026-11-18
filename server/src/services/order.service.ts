import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { OrderDto, OrderStatus } from '../types';

interface OrderCreateData {
  title: string;
  price: number;
  currency: string;
  customerEmail: string;
}

export class OrderService {
  private orders = new Map<string, OrderDto>();
  private readonly persistencePath: string;

  constructor(options?: string | { persistenceDir?: string }) {
    if (typeof options === 'string') {
      this.persistencePath = path.join(options, 'orders.json');
    } else if (options?.persistenceDir) {
      this.persistencePath = path.join(options.persistenceDir, 'orders.json');
    } else {
      this.persistencePath = path.join(process.cwd(), 'orders.json');
    }
    this.loadFromDisk();
  }

  private saveToDisk(): void {
    const ordersArray = Array.from(this.orders.values());
    const json = JSON.stringify(ordersArray, null, 2);
    fs.writeFileSync(this.persistencePath, json, 'utf-8');
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.persistencePath)) return;
    try {
      const data = fs.readFileSync(this.persistencePath, 'utf-8');
      const ordersArray: OrderDto[] = JSON.parse(data);
      for (const order of ordersArray) {
        this.orders.set(order.id, order);
      }
    } catch {
      // corrupt file, start fresh
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  async createOrder(data: OrderCreateData): Promise<OrderDto> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const order: OrderDto = {
      id,
      title: data.title,
      price: data.price,
      currency: data.currency,
      status: 'PENDING',
      customerEmail: data.customerEmail,
      paymentId: null,
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    this.saveToDisk();
    return order;
  }

  async getOrderById(id: string): Promise<OrderDto | null> {
    return this.orders.get(id) || null;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return order;
  }

  async updatePaymentId(
    orderId: string,
    paymentId: string
  ): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;
    order.paymentId = paymentId;
    order.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return order;
  }

  async updateIdempotencyKey(
    orderId: string,
    idempotencyKey: string
  ): Promise<OrderDto | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;
    order.idempotencyKey = idempotencyKey;
    order.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return order;
  }
}
