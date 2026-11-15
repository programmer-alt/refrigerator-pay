import { OrderService } from '../services/order.service';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    service = new OrderService();
  });

  describe('createOrder', () => {
    it('should create an order with provided data', async () => {
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
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
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
      const result = await service.getOrderById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status to PAID and persist', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'PAID');

      expect(result?.status).toBe('PAID');
      // 🔴 Verify persistence: fetch again and check the updated value
      const persisted = await service.getOrderById(order.id);
      expect(persisted?.status).toBe('PAID');
    });

    it('should update order status to CANCELED and persist', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'CANCELED');

      expect(result?.status).toBe('CANCELED');
      const persisted = await service.getOrderById(order.id);
      expect(persisted?.status).toBe('CANCELED');
    });

    it('should return null for non-existent order', async () => {
      const result = await service.updateOrderStatus('nonexistent', 'PAID');
      expect(result).toBeNull();
    });
  });

  describe('updatePaymentId', () => {
    it('should update payment id for order and persist', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updatePaymentId(order.id, 'pay_456');

      expect(result?.paymentId).toBe('pay_456');
      // 🔴 Verify persistence: fetch again and check the updated value
      const persisted = await service.getOrderById(order.id);
      expect(persisted?.paymentId).toBe('pay_456');
    });

    it('should return null for non-existent order', async () => {
      const result = await service.updatePaymentId('nonexistent', 'pay_456');
      expect(result).toBeNull();
    });
  });

  describe('updateIdempotencyKey', () => {
    it('should update idempotency key and persist', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateIdempotencyKey(order.id, 'idem_789');

      expect(result?.idempotencyKey).toBe('idem_789');
      // 🔴 Verify persistence: fetch again and check the updated value
      const persisted = await service.getOrderById(order.id);
      expect(persisted?.idempotencyKey).toBe('idem_789');
    });
  });

  describe('isolation', () => {
    it('should not share orders between instances', async () => {
      const serviceA = new OrderService();
      const serviceB = new OrderService();

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

  describe('ID generation', () => {
    it('should use crypto.randomUUID() — 36-char UUID format', async () => {
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

  describe('LRU eviction', () => {
    it('should evict oldest orders when map exceeds MAX_ORDERS', async () => {
      const MAX = 10;
      // Override MAX_ORDERS for testing
      (service as any).MAX_ORDERS = MAX;

      // Create MAX + 5 orders
      const orders: any[] = [];
      for (let i = 0; i < MAX + 5; i++) {
        const order = await service.createOrder({
          title: `Order ${i}`,
          price: 100 + i,
          currency: 'RUB',
          customerEmail: `test${i}@test.com`,
        });
        orders.push(order);
      }

      // After creating MAX+5 orders with MAX=10, we should have exactly 10 orders
      expect(service['orders'].size).toBe(MAX);

      // Oldest orders (0..4) should be evicted, newest (5..9) should remain
      const evictedOrder = await service.getOrderById(orders[0].id);
      expect(evictedOrder).toBeNull(); // Order 0 was evicted

      const newestOrder = await service.getOrderById(orders[9].id);
      expect(newestOrder).not.toBeNull(); // Order 9 should exist
      expect(newestOrder?.title).toBe('Order 9');
    });
  });
});
