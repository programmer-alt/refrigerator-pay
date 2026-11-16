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
 * Internal order with access tracking (not exposed to callers).
 */
interface InternalOrder extends OrderDto {
  __lastAccessedAt: number;
}

/**
 * OrderService — in-memory хранилище заказов с file-based persistence.
 *
 * 🔒 ТРАНЗАКЦИОННАЯ МОДЕЛЬ (memory-first with rollback):
 *   - Сначала this.orders.set() — память обновляется
 *   - Потом saveToDisk() — сохраняем на диск
 *   - При крахе saveToDisk — rollback (возвращаем старый стейт или удаляем)
 *   - Гарантирует: если saveToDisk успешен, данные на диске согласованы с памятью
 *
 * 🔒 БЕЗОПАСНЫЙ КАРАНТИН:
 *   - Только SyntaxError (JSON corruption) → quarantine с уникальным именем
 *   - I/O errors → не карантиним, выбрасываем ошибку
 *   - После карантина НЕ кидает ошибку — сервер запускается с пустым Map
 *
 * 🔒 БЕЗОПАСНАЯ ЭВАКУАЦИЯ:
 *   - Evict только PENDING с paymentId === null
 *   - Если недостаточно — бросаем Error (503), не трогаем PAID/CANCELED
 *
 * 🔒 МОНОТОННОСТЬ СТАТУСОВ:
 *   - PAID/CANCELED — терминальные, не меняются
 *   - PENDING → PAID | CANCELED
 *
 * 🔒 ПЕРСИСТЕНЦИЯ __lastAccessedAt:
 *   - Сохраняется в JSON, восстанавливается при загрузке
 */
export class OrderService {
  private orders = new Map<string, InternalOrder>();

  /** Максимальное количество заказов в Map */
  private readonly maxOrders: number;
  /** Время жизни заказа (7 дней) */
  private readonly maxAgeMs: number;
  /** Путь к файлу persistence */
  private readonly persistencePath: string;

  constructor(options?: string | OrderServiceOptions) {
    if (typeof options === 'string') {
      // Обратная совместимость: constructor('path/to/dir')
      this.persistencePath = path.join(options, 'orders.json');
      this.maxOrders = 10000;
      this.maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    } else if (options) {
      this.persistencePath = path.join(options.persistenceDir || process.cwd(), 'orders.json');
      this.maxOrders = options.maxOrders ?? 10000;
      this.maxAgeMs = options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    } else {
      this.persistencePath = path.join(process.cwd(), 'orders.json');
      this.maxOrders = 10000;
      this.maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    }
    this.loadFromDisk();
  }

  /**
   * Strip internal fields before returning to caller.
   */
  private _stripInternal(order: InternalOrder): OrderDto {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __lastAccessedAt, ...rest } = order;
    return rest as OrderDto;
  }

  /**
   * Atomic write: serializes to file with mode 0o600, then renames.
   * Logs underlying error on failure and rethrows.
   */
  private saveToDisk(): void {
    const ordersArray: OrderDto[] = Array.from(this.orders.values()).map(
      ({ __lastAccessedAt, ...rest }) => rest
    );
    const json = JSON.stringify(ordersArray, null, 2);
    const tmpPath = this.persistencePath + '.tmp.' + crypto.randomUUID();

    try {
      // Создаём файл сразу с mode 0o600 — chmod не нужен
      fs.writeFileSync(tmpPath, json, { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmpPath, this.persistencePath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore cleanup failure */
      }
      console.error('❌ Failed to persist orders to disk:', err);
      throw err;
    }
  }

  /**
   * Load orders from disk. Quarantines ONLY JSON corruption (SyntaxError).
   * I/O errors are re-thrown (valid file, can't read it).
   * After quarantine, initializes empty Map — does NOT throw.
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
      if (err instanceof SyntaxError) {
        // JSON corruption — quarantine with unique name
        const quarantinePath = this.persistencePath + '.' + Date.now() + '.quarantine';
        try {
          fs.renameSync(this.persistencePath, quarantinePath);
          console.error(
            `⚠️ Corrupt orders.json quarantined to ${quarantinePath}. Starting fresh.`
          );
        } catch {
          console.error('⚠️ Failed to quarantine corrupt orders.json');
        }
        this.orders.clear();
        return; // НЕ кидать ошибку — сервер запустится
      }
      // I/O error or other — не карантиним валидный файл
      console.error('❌ Failed to load orders from disk:', err);
      throw err;
    }
  }

  /**
   * Генерирует криптографически случайный ID.
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Prune expired orders from the map.
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
   * LRU-эвакуация: удаляет только PENDING заказы БЕЗ paymentId.
   * Не трогает PAID/CANCELED и заказы с активным платежом.
   * Бросает Error если недостаточно evictable — не удаляет завершенные.
   */
  private evictIfNeeded(): void {
    if (this.orders.size < this.maxOrders) return;

    // Сначала удаляем просроченные
    this.pruneExpired();

    if (this.orders.size >= this.maxOrders) {
      const toDeleteCount = this.orders.size - this.maxOrders + 1;
      // Только PENDING без paymentId — заказы с активным платежом не эвактируем
      const evictable = [...this.orders.entries()]
        .filter(([, order]) => order.status === 'PENDING' && order.paymentId === null)
        .sort((a, b) => a[1].__lastAccessedAt - b[1].__lastAccessedAt);

      if (evictable.length < toDeleteCount) {
        throw new Error(
          `Cannot create order: store full (${this.orders.size}/${this.maxOrders}). ` +
          `Need to evict ${toDeleteCount}, but only ${evictable.length} evictable ` +
          `(PENDING without paymentId). Complete or expire existing orders first.`
        );
      }

      const toDelete = evictable.slice(0, toDeleteCount);
      for (const [id] of toDelete) {
        this.orders.delete(id);
      }
    }
  }

  async createOrder(data: OrderCreateData): Promise<OrderDto> {
    this.evictIfNeeded();

    // Retry loop for collision resistance
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = this.generateId();
      if (this.orders.has(id)) continue;

      const now = new Date().toISOString();
      const order: InternalOrder = {
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

      // ТРАНЗАКЦИЯ: сначала память, потом диск. При крахе диска — rollback
      this.orders.set(order.id, order);
      try {
        this.saveToDisk();
      } catch (err) {
        this.orders.delete(order.id); // rollback on save failure
        console.error('❌ Failed to persist new order:', err);
        throw err;
      }
      return this._stripInternal(order);
    }

    // Fallback (extremely unlikely)
    const fallbackId = crypto.randomUUID();
    const now = new Date().toISOString();
    const order: InternalOrder = {
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
      this.orders.delete(order.id);
      console.error('❌ Failed to persist new order:', err);
      throw err;
    }
    return this._stripInternal(order);
  }

  async getOrderById(id: string): Promise<OrderDto | null> {
    const entry = this.orders.get(id);
    if (!entry) return null;

    // Prune expired on lookup
    const age = Date.now() - new Date(entry.createdAt).getTime();
    if (age > this.maxAgeMs) {
      this.orders.delete(id);
      try {
        this.saveToDisk();
      } catch {
        /* ignore save error on prune */
      }
      return null;
    }

    // Update last accessed for LRU tracking
    entry.__lastAccessedAt = Date.now();
    return this._stripInternal(entry);
  }

  /**
   * Транзакционное обновление статуса: сначала память, потом диск.
   * Монотонность: PAID/CANCELED — терминальные, не меняются.
   * При крахе saveToDisk — rollback к старому статусу.
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    // Монотонность: терминальные статусы не меняются
    if (entry.status === 'PAID' || entry.status === 'CANCELED') {
      return this._stripInternal(entry);
    }

    const oldStatus = entry.status;
    const updated: InternalOrder = {
      ...entry,
      status,
      updatedAt: new Date().toISOString(),
    };

    // ТРАНЗАКЦИЯ: сначала память
    this.orders.set(orderId, updated);

    // Потом диск
    try {
      this.saveToDisk();
    } catch (err) {
      // Rollback на старый статус
      const rollback: InternalOrder = {
        ...updated,
        status: oldStatus,
        updatedAt: entry.updatedAt,
      };
      this.orders.set(orderId, rollback);
      console.error('❌ Failed to persist order status update, rolled back:', err);
      throw err;
    }
    return this._stripInternal(updated);
  }

  /**
   * Транзакционное обновление paymentId: сначала память, потом диск.
   * При крахе saveToDisk — rollback к старому paymentId.
   */
  async updatePaymentId(orderId: string, paymentId: string): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    const oldPaymentId = entry.paymentId;
    const updated: InternalOrder = {
      ...entry,
      paymentId,
      updatedAt: new Date().toISOString(),
    };

    // ТРАНЗАКЦИЯ: сначала память
    this.orders.set(orderId, updated);

    // Потом диск
    try {
      this.saveToDisk();
    } catch (err) {
      // Rollback
      const rollback: InternalOrder = {
        ...updated,
        paymentId: oldPaymentId,
        updatedAt: entry.updatedAt,
      };
      this.orders.set(orderId, rollback);
      console.error('❌ Failed to persist paymentId update, rolled back:', err);
      throw err;
    }
    return this._stripInternal(updated);
  }

  /**
   * Транзакционное обновление idempotencyKey: сначала память, потом диск.
   * При крахе saveToDisk — rollback к старому ключу.
   */
  async updateIdempotencyKey(
    orderId: string,
    idempotencyKey: string
  ): Promise<OrderDto | null> {
    const entry = this.orders.get(orderId);
    if (!entry) return null;

    const oldKey = entry.idempotencyKey;
    const updated: InternalOrder = {
      ...entry,
      idempotencyKey,
      updatedAt: new Date().toISOString(),
    };

    // ТРАНЗАКЦИЯ: сначала память
    this.orders.set(orderId, updated);

    // Потом диск
    try {
      this.saveToDisk();
    } catch (err) {
      // Rollback
      const rollback: InternalOrder = {
        ...updated,
        idempotencyKey: oldKey,
        updatedAt: entry.updatedAt,
      };
      this.orders.set(orderId, rollback);
      console.error('❌ Failed to persist idempotencyKey update, rolled back:', err);
      throw err;
    }
    return this._stripInternal(updated);
  }

  /**
   * Атомарная резервация idempotencyKey для заказа.
   *
   * Синхронно проверяет и устанавливает ключ (без await между check и set),
   * что предотвращает race condition при параллельных createPayment запросах.
   *
   * @returns ключ, который уже есть или только что создан
   * @throws если заказ не найден
   */
  async reserveIdempotencyKey(orderId: string): Promise<string> {
    const entry = this.orders.get(orderId);
    if (!entry) throw new Error(`Order ${orderId} not found`);

    // Уже зарезервирован — возвращаем существующий
    if (entry.idempotencyKey) {
      return entry.idempotencyKey;
    }

    // Синхронно устанавливаем ключ (другой Promise не вмешается без await)
    const key = `idem_${orderId}_${crypto.randomUUID()}`;
    entry.idempotencyKey = key;
    entry.updatedAt = new Date().toISOString();

    // Асинхронно сохраняем на диск
    try {
      this.saveToDisk();
    } catch (err) {
      console.error('❌ Failed to persist idempotencyKey reservation:', err);
      throw err;
    }

    return key;
  }
}
