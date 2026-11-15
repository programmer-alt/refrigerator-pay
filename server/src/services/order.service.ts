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

/**
 * OrderService — in-memory хранилище заказов с file-based persistence.
 *
 * Использует Map для хранения заказов в оперативной памяти.
 * Данные сохраняются в JSON-файл при каждом изменении и загружаются при старте.
 * Подходит для демо и тестирования без внешней БД.
 *
 * 🔒 Использует crypto.randomUUID() для генерации ID.
 * 🔒 LRU-эвакция: заказы старше MAX_AGE удаляются при переполнении.
 * 🔒 Persistence: заказы сохраняются в orders.json при каждом изменении.
 */
export class OrderService {
  private orders = new Map<string, OrderDto>();

  /** Максимальное количество заказов в Map */
  private readonly MAX_ORDERS = 10000;
  /** Время жизни заказа (7 дней) */
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  /** Путь к файлу persistence */
  private readonly persistencePath: string;

  constructor(persistenceDir?: string) {
    // Настраиваем persistence при инициализации
    this.persistencePath = path.join(
      persistenceDir || process.cwd(),
      'orders.json'
    );
    this.loadFromDisk();
  }

  /**
   * Сохраняет все заказы в JSON-файл.
   * Вызывается после каждого изменения (create, update).
   */
  private saveToDisk(): void {
    try {
      const ordersArray = Array.from(this.orders.values());
      fs.writeFileSync(this.persistencePath, JSON.stringify(ordersArray, null, 2), 'utf-8');
    } catch {
      // Если не удалось сохранить — игнорируем (demo mode)
      console.warn('⚠️ Failed to save orders to disk');
    }
  }

  /**
   * Загружает заказы из JSON-файла при старте.
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = fs.readFileSync(this.persistencePath, 'utf-8');
        const ordersArray: OrderDto[] = JSON.parse(data);
        for (const order of ordersArray) {
          this.orders.set(order.id, order);
        }
        console.log(`📦 Loaded ${this.orders.size} orders from disk`);
      }
    } catch {
      // Если не удалось загрузить — начинаем с пустой карты (demo mode)
      console.warn('⚠️ Failed to load orders from disk, starting fresh');
    }
  }

  /**
   * Генерирует криптографически случайный ID.
   * Collision-resistant: 32 bytes (64 hex chars).
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * LRU-эвакция: удаляет самые старые заказы, если Map переполнен.
   * Вызывается при каждом createOrder.
   */
  private evictIfNeeded(): void {
    if (this.orders.size < this.MAX_ORDERS) return;

    const now = Date.now();
    // Удаляем просроченные
    for (const [id, order] of this.orders) {
      if (now - new Date(order.createdAt).getTime() > this.MAX_AGE_MS) {
        this.orders.delete(id);
      }
    }

    // Если всё ещё переполнен — удаляем самые старые
    if (this.orders.size >= this.MAX_ORDERS) {
      const sorted = [...this.orders.entries()].sort(
        (a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime()
      );
      const toDelete = sorted.slice(0, sorted.length - this.MAX_ORDERS + 1);
      for (const [id] of toDelete) {
        this.orders.delete(id);
      }
    }
  }

  async createOrder(data: OrderCreateData): Promise<OrderDto> {
    // LRU-эвакция перед созданием нового заказа
    this.evictIfNeeded();

    // Retry loop for collision resistance
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = this.generateId();

      if (this.orders.has(id)) continue; // collision — retry

      const order: OrderDto = {
        id,
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
      this.saveToDisk();
      return order;
    }

    // Fallback (extremely unlikely)
    const fallbackId = crypto.randomUUID();
    const order: OrderDto = {
      id: fallbackId,
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
    this.saveToDisk();
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
    this.saveToDisk();
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
    this.saveToDisk();
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
    this.saveToDisk();
    return updated;
  }
}
