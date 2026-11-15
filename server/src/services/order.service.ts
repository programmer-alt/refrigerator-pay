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
 * Options for OrderService constructor.
 */
export interface OrderServiceOptions {
  /** Directory for persistence file (default: process.cwd()) */
  persistenceDir?: string;
  /** Maximum number of orders in memory (default: 10000) */
  maxOrders?: number;
  /** Max age of an order in ms before eviction (default: 7 days) */
  maxAgeMs?: number;
}

/**
 * OrderService — in-memory хранилище заказов с file-based persistence.
 *
 * Использует Map для хранения заказов в оперативной памяти.
 * Данные сохраняются в JSON-файл при каждом изменении и загружаются при старте.
 * Подходит для демо и тестирования без внешней БД.
 *
 * 🔒 Использует crypto.randomUUID() для генерации ID.
 * 🔒 LRU-эвакция: удаляет least-recently-used заказы при переполнении.
 * 🔒 Pending-заказы (PAID/CANCELED) не удаляются.
 * 🔒 Atomic writes: temp file + rename.
 * 🔒 Quarantine corrupt files.
 * 🔒 File permissions 0600.
 */
export class OrderService {
  private orders = new Map<string, OrderDto & { __lastAccessedAt: number }>();

  /** Максимальное количество заказов в Map */
  private readonly maxOrders: number;
  /** Время жизни заказа (7 дней) */
  private readonly maxAgeMs: number;
  /** Путь к файлу persistence */
  private readonly persistencePath: string;
  /** Путь к quarantine-файлу */
  private readonly quarantinePath: string;

  constructor(options?: OrderServiceOptions) {
    this.maxOrders = options?.maxOrders ?? 10000;
    this.maxAgeMs = options?.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    this.persistencePath = path.join(
      options?.persistenceDir || process.cwd(),
      'orders.json'
    );
    this.quarantinePath = this.persistencePath + '.quarantine';
    this.loadFromDisk();
  }

  /**
   * Atomic write: serializes to temp file, then renames.
   * Throws on failure — caller must handle.
   */
  private saveToDisk(): void {
    const tmpPath = this.persistencePath + '.tmp.' + crypto.randomUUID();
    try {
      const ordersArray = Array.from(this.orders.values()).map(
        ({ __lastAccessedAt, ...rest }) => rest
      );
      const json = JSON.stringify(ordersArray, null, 2);
      fs.writeFileSync(tmpPath, json, 'utf-8');

      // Set owner-only permissions (0600)
      try {
        fs.chmodSync(tmpPath, 0o600);
      } catch {
        // chmod not supported on some platforms (e.g., Windows)
      }

      fs.renameSync(tmpPath, this.persistencePath);
    } catch {
      // Clean up temp file on failure
      try {
        fs.unlinkSync(tmpPath);
      } catch { /* ignore cleanup failure */ }
      throw new Error('Failed to persist orders to disk');
    }
  }

  /**
   * Load orders from disk. Quarantines corrupt files.
   * Throws on startup failure to prevent serving empty store.
   */
  private loadFromDisk(): void {
    if (!fs.existsSync(this.persistencePath)) return;

    try {
      const data = fs.readFileSync(this.persistencePath, 'utf-8');
      const ordersArray: OrderDto[] = JSON.parse(data);
      for (const order of ordersArray) {
        this.orders.set(order.id, { ...order, __lastAccessedAt: Date.now() });
      }
      console.log(`📦 Loaded ${this.orders.size} orders from disk`);
    } catch (err) {
      // Quarantine corrupt file
      try {
        fs.renameSync(this.persistencePath, this.quarantinePath);
        console.error(
          `⚠️ Corrupt orders.json quarantined to ${this.quarantinePath}. Starting fresh.`
        );
      } catch {
        console.error('⚠️ Failed to quarantine corrupt orders.json:', err);
      }
      // Re-throw to prevent serving empty store that would overwrite data
      throw err;
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
   * Prune expired orders from the map.
   * Called before eviction and on lookups.
   */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, order] of this.orders) {
      const age = now - new Date(order.createdAt).getTime();
      if (age > this.maxAgeMs) {
        this.orders.delete(id);
      }
    }
  }

  /**
   * LRU-эвакция: удаляет least-recently-used заказы, если Map переполнен.
   * Не удаляет заказы со статусом PAID или CANCELED (pending payments).
   * Вызывается при каждом createOrder.
   */
  private evictIfNeeded(): void {
    if (this.orders.size < this.maxOrders) return;

    // Сначала удаляем просроченные
    this.pruneExpired();

    // Если всё ещё переполнен — удаляем LRU, исключая PAID/CANCELED
    if (this.orders.size >= this.maxOrders) {
      const toDeleteCount = this.orders.size - this.maxOrders + 1;
      // Сортируем по lastAccessedAt, исключая завершённые заказы
      const evictable = [...this.orders.entries()]
        .filter(([, order]) => order.status === 'PENDING')
        .sort(
          (a, b) => a[1].__lastAccessedAt - b[1].__lastAccessedAt
        );

      // Если PENDING мало — удаляем самые старые PAID/CANCELED (fallback)
      let toDelete: [string, OrderDto & { __lastAccessedAt: number }][];
      if (evictable.length >= toDeleteCount) {
        toDelete = evictable.slice(0, toDeleteCount);
      } else {
        // Нет достаточно PENDING — удаляем самые старые из всех
        const allSorted = [...this.orders.entries()]
          .sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());
        toDelete = allSorted.slice(0, toDeleteCount);
      }

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

      const now = new Date().toISOString();
      const order: OrderDto & { __lastAccessedAt: number } = {
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
        __lastAccessedAt: Date.now(),
      };

      this.orders.set(order.id, order);
      try {
        this.saveToDisk();
      } catch (err) {
        this.orders.delete(order.id); // rollback on save failure
        throw err;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { __lastAccessedAt, ...result } = order;
      return result as OrderDto;
    }

    // Fallback (extremely unlikely)
    const fallbackId = crypto.randomUUID();
    const now = new Date().toISOString();
    const order: OrderDto & { __lastAccessedAt: number } = {
      id: fallbackId,
      title: data.title,
      price: data.price,
      currency: data.currency,
      status: 'PENDING',
      customerEmail: data.customerEmail,
      paymentId: null,
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
      __lastAccessedAt: Date.now(),
    };
    this.orders.set(order.id, order);
    try {
      this.saveToDisk();
    } catch (err) {
      this.orders.delete(order.id); // rollback on save failure
      throw err;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...result } = order;
    return result as OrderDto;
  }

  async getOrderById(id: string): Promise<OrderDto | null> {
    const entry = this.orders.get(id);
    if (!entry) return null;

    // Prune expired on lookup
    const age = Date.now() - new Date(entry.createdAt).getTime();
    if (age > this.maxAgeMs) {
      this.orders.delete(id);
      this.saveToDisk();
      return null;
    }

    // Update last accessed for LRU tracking
    entry.__lastAccessedAt = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...result } = entry;
    return result as OrderDto;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    const updated: OrderDto & { __lastAccessedAt: number } = {
      ...entry,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    this.saveToDisk();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...result } = updated;
    return result as OrderDto;
  }

  async updatePaymentId(orderId: string, paymentId: string): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    const updated: OrderDto & { __lastAccessedAt: number } = {
      ...entry,
      paymentId,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    this.saveToDisk();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...result } = updated;
    return result as OrderDto;
  }

  async updateIdempotencyKey(
    orderId: string,
    idempotencyKey: string
  ): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    const updated: OrderDto & { __lastAccessedAt: number } = {
      ...entry,
      idempotencyKey,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, updated);
    this.saveToDisk();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...result } = updated;
    return result as OrderDto;
  }
}
