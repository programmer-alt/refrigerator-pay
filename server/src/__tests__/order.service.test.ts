import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrderService } from '../services/order.service';

describe('OrderService', () => {
  let tmpDir: string;

  function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'order-service-test-'));
  }

  function cleanupTmpDir(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  /**
   * Helper: create a fresh service instance pointing to the same persistence file.
   * Used to verify persistence survives restarts (Comment 12).
   */
  function createFreshService(): OrderService {
    return new OrderService({ persistenceDir: tmpDir, maxOrders: 10000 });
  }

  describe('createOrder', () => {
    it('should create an order with provided data', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const result = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.title).toBe('Test Product');
      expect(result.price).toBe(1000);
      expect(result.currency).toBe('RUB');
      expect(result.status).toBe('PENDING');
      expect(result.customerEmail).toBe('test@example.com');
      expect(result.paymentId).toBeNull();
      expect(result.idempotencyKey).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should persist order and reload via fresh instance (Comment 12)', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Persist Test',
        price: 500,
        currency: 'RUB',
        customerEmail: 'persist@test.com',
      });

      // Create fresh instance (simulates restart)
      const fresh = createFreshService();
      const reloaded = await fresh.getOrderById(order.id);

      expect(reloaded).not.toBeNull();
      expect(reloaded?.title).toBe('Persist Test');
      expect(reloaded?.price).toBe(500);
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.getOrderById(order.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(order.id);
      expect(result?.title).toBe('Test Product');
    });

    it('should return null for non-existent order', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const result = await service.getOrderById('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for expired order (Comment 9)', async () => {
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxAgeMs: 1, // 1ms expiry for testing
      });
      const order = await service.createOrder({
        title: 'Expired Test',
        price: 100,
        currency: 'RUB',
        customerEmail: 'exp@test.com',
      });

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const result = await service.getOrderById(order.id);
      expect(result).toBeNull();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status to PAID and persist (Comment 12)', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'PAID');
      expect(result?.status).toBe('PAID');

      // Verify persistence via fresh instance
      const fresh = createFreshService();
      const persisted = await fresh.getOrderById(order.id);
      expect(persisted?.status).toBe('PAID');
    });

    it('should update order status to CANCELED and persist (Comment 12)', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'CANCELED');
      expect(result?.status).toBe('CANCELED');

      // Verify persistence via fresh instance
      const fresh = createFreshService();
      const persisted = await fresh.getOrderById(order.id);
      expect(persisted?.status).toBe('CANCELED');
    });

    it('should return null for non-existent order', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const result = await service.updateOrderStatus('nonexistent', 'PAID');
      expect(result).toBeNull();
    });
  });

  describe('updatePaymentId', () => {
    it('should update payment id for order and persist (Comment 12)', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updatePaymentId(order.id, 'pay_456');
      expect(result?.paymentId).toBe('pay_456');

      // Verify persistence via fresh instance
      const fresh = createFreshService();
      const persisted = await fresh.getOrderById(order.id);
      expect(persisted?.paymentId).toBe('pay_456');
    });

    it('should return null for non-existent order', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const result = await service.updatePaymentId('nonexistent', 'pay_456');
      expect(result).toBeNull();
    });
  });

  describe('updateIdempotencyKey', () => {
    it('should update idempotency key and persist (Comment 12)', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateIdempotencyKey(order.id, 'idem_789');
      expect(result?.idempotencyKey).toBe('idem_789');

      // Verify persistence via fresh instance
      const fresh = createFreshService();
      const persisted = await fresh.getOrderById(order.id);
      expect(persisted?.idempotencyKey).toBe('idem_789');
    });
  });

  describe('isolation', () => {
    it('should not share orders between instances', async () => {
      const serviceA = new OrderService({ persistenceDir: createTmpDir() });
      const serviceB = new OrderService({ persistenceDir: createTmpDir() });

      const orderA = await serviceA.createOrder({
        title: 'Service A Order',
        price: 100,
        currency: 'RUB',
        customerEmail: 'a@test.com',
      });

      const orderB = await serviceB.createOrder({
        title: 'Service B Order',
        price: 200,
        currency: 'RUB',
        customerEmail: 'b@test.com',
      });

      expect(orderA.id).not.toBe(orderB.id);
      expect(orderA.title).toBe('Service A Order');
      expect(orderB.title).toBe('Service B Order');
      expect(await serviceA.getOrderById(orderB.id)).toBeNull();
      expect(await serviceB.getOrderById(orderA.id)).toBeNull();
    });
  });

  describe('ID generation (Comment 3/7)', () => {
    it('should use crypto.randomUUID() — 36-char UUID format', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const order = await service.createOrder({
        title: 'Test',
        price: 100,
        currency: 'RUB',
        customerEmail: 'test@test.com',
      });

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(order.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs for concurrent orders', async () => {
      const service = new OrderService({ persistenceDir: tmpDir });
      const [order1, order2, order3] = await Promise.all([
        service.createOrder({ title: 'A', price: 100, currency: 'RUB', customerEmail: 'a@t.com' }),
        service.createOrder({ title: 'B', price: 200, currency: 'RUB', customerEmail: 'b@t.com' }),
        service.createOrder({ title: 'C', price: 300, currency: 'RUB', customerEmail: 'c@t.com' }),
      ]);

      expect(order1.id).not.toBe(order2.id);
      expect(order2.id).not.toBe(order3.id);
      expect(order1.id).not.toBe(order3.id);
    });
  });

  describe('LRU eviction (Comment 5/6)', () => {
    it('should evict least-recently-used PENDING orders (Comment 6)', async () => {
      const MAX = 5;
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: MAX,
      });

      // Create MAX orders with small delays to ensure distinct timestamps
      const orders: any[] = [];
      for (let i = 0; i < MAX; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100 + i,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
        if (i < MAX - 1) {
          await new Promise((r) => setTimeout(r, 2));
        }
      }

      // Access order 0 to make it "recently used"
      await service.getOrderById(orders[0].id);

      // Create one more to trigger eviction
      await service.createOrder({
        title: 'Trigger Eviction',
        price: 999,
        currency: 'RUB',
        customerEmail: 'evict@test.com',
      });

      // Order 0 should still exist (recently accessed)
      const accessedOrder = await service.getOrderById(orders[0].id);
      expect(accessedOrder).not.toBeNull();

      // Map should have exactly MAX orders
      expect(service['orders'].size).toBe(MAX);

      // LRU: order 1 is least recently used (oldest creation, not accessed)
      // Order 4 is most recently created (highest __lastAccessedAt among PENDING)
      // So order 1 should be evicted, order 4 should survive
      const remainingIds = [...service['orders'].keys()];
      expect(remainingIds).not.toContain(orders[1].id); // LRU evicted
      expect(remainingIds).toContain(orders[0].id); // recently accessed
      expect(remainingIds).toContain(orders[4].id); // most recently created
    });

    it('should NOT evict PAID/CANCELED orders (Comment 5)', async () => {
      const MAX = 5;
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: MAX,
      });

      // Create MAX orders
      const orders: any[] = [];
      for (let i = 0; i < MAX; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100 + i,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      // Mark order 0 as PAID
      await service.updateOrderStatus(orders[0].id, 'PAID');

      // Create one more to trigger eviction
      await service.createOrder({
        title: 'Trigger Eviction',
        price: 999,
        currency: 'RUB',
        customerEmail: 'evict@test.com',
      });

      // PAID order should NOT be evicted
      const paidOrder = await service.getOrderById(orders[0].id);
      expect(paidOrder).not.toBeNull();
      expect(paidOrder?.status).toBe('PAID');
    });
  });

  describe('constructor options (Comment 14, 17)', () => {
    it('should evict expired orders and accept new ones (maxAgeMs)', async () => {
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: 100,
        maxAgeMs: 50, // 50ms for fast testing
      });

      // Create 3 orders
      const orders: any[] = [];
      for (let i = 0; i < 3; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 60));

      // Orders should be expired
      for (const order of orders) {
        const retrieved = await service.getOrderById(order.id);
        expect(retrieved).toBeNull();
      }

      // Map should be empty (expired orders pruned on next operation)
      // Create one more — should succeed (expired orders pruned first)
      const newOrder = await service.createOrder({
        title: 'New Order',
        price: 100,
        currency: 'RUB',
        customerEmail: 'new@test.com',
      });

      expect(newOrder).toBeDefined();
      expect(newOrder.title).toBe('New Order');

      // Verify expired orders are gone from map
      expect(service['orders'].size).toBe(1);
    });

    it('should evict PENDING orders when maxOrders reached', async () => {
      const MAX = 3;
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: MAX,
        maxAgeMs: 60000, // 60s, no expiry
      });

      // Create MAX orders
      const orders: any[] = [];
      for (let i = 0; i < MAX; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      expect(service['orders'].size).toBe(MAX);

      // Create one more — should evict oldest PENDING
      const newOrder = await service.createOrder({
        title: 'New Order',
        price: 100,
        currency: 'RUB',
        customerEmail: 'new@test.com',
      });

      expect(newOrder).toBeDefined();
      expect(service['orders'].size).toBe(MAX);

      // Oldest order (Order 0) should be evicted
      const evicted = await service.getOrderById(orders[0].id);
      expect(evicted).toBeNull();

      // Newest order should exist
      const retrieved = await service.getOrderById(newOrder.id);
      expect(retrieved).not.toBeNull();
    });

    it('should throw 503 when no PENDING orders available for eviction', async () => {
      const MAX = 3;
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: MAX,
        maxAgeMs: 60000,
      });

      // Create MAX orders
      const orders: any[] = [];
      for (let i = 0; i < MAX; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      // Mark ALL orders as PAID — none evictable
      for (const order of orders) {
        await service.updateOrderStatus(order.id, 'PAID');
      }

      // Try to create new order — should throw
      await expect(
        service.createOrder({
          title: 'New Order',
          price: 100,
          currency: 'RUB',
          customerEmail: 'new@test.com',
        })
      ).rejects.toThrow(/store full|evict/);
    });

    it('should NOT evict orders with active paymentId', async () => {
      const MAX = 3;
      const service = new OrderService({
        persistenceDir: tmpDir,
        maxOrders: MAX,
        maxAgeMs: 60000,
      });

      // Create MAX orders
      const orders: any[] = [];
      for (let i = 0; i < MAX; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      // Set paymentId on order 0 — it should NOT be evicted
      await service.updatePaymentId(orders[0].id, 'pay_active');

      // Create one more to trigger eviction
      const newOrder = await service.createOrder({
        title: 'New Order',
        price: 100,
        currency: 'RUB',
        customerEmail: 'new@test.com',
      });

      expect(newOrder).toBeDefined();

      // Order with paymentId should still exist
      const withPayment = await service.getOrderById(orders[0].id);
      expect(withPayment).not.toBeNull();
      expect(withPayment?.paymentId).toBe('pay_active');

      // Order without paymentId should be evicted
      const noPayment = await service.getOrderById(orders[1].id);
      expect(noPayment).toBeNull();
    });
  });
});
