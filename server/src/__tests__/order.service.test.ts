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
    it('should update order status to PAID', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'PAID');

      expect(result?.status).toBe('PAID');
    });

    it('should update order status to CANCELED', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateOrderStatus(order.id, 'CANCELED');

      expect(result?.status).toBe('CANCELED');
    });

    it('should return null for non-existent order', async () => {
      const result = await service.updateOrderStatus('nonexistent', 'PAID');
      expect(result).toBeNull();
    });
  });

  describe('updatePaymentId', () => {
    it('should update payment id for order', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updatePaymentId(order.id, 'pay_456');

      expect(result?.paymentId).toBe('pay_456');
    });

    it('should return null for non-existent order', async () => {
      const result = await service.updatePaymentId('nonexistent', 'pay_456');
      expect(result).toBeNull();
    });
  });

  describe('updateIdempotencyKey', () => {
    it('should update idempotency key', async () => {
      const order = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.updateIdempotencyKey(order.id, 'idem_789');

      expect(result?.idempotencyKey).toBe('idem_789');
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
});
