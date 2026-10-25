import { OrderService } from '../services/order.service';

// Получаем мока из setup.ts через require
const mockPrismaClient = require('../__tests__/setup').mockPrismaClient;

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    service = new OrderService();
  });

  describe('createOrder', () => {
    it('should create an order with provided data', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@example.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('ord_123');
      expect(result.title).toBe('Test Product');
      expect(result.price).toBe(1000);
      expect(result.status).toBe('PENDING');
    });

    it('should convert decimal price to number correctly', async () => {
      const mockOrder = {
        id: 'ord_456',
        title: 'Product',
        price: '999.99', // Prisma возвращает Decimal как string
        currency: 'USD',
        status: 'PENDING' as const,
        customerEmail: 'user@test.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder({
        title: 'Product',
        price: 999.99,
        currency: 'USD',
        customerEmail: 'user@test.com',
      });

      expect(result.price).toBe(999.99);
      expect(result.currency).toBe('USD');
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@example.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('ord_123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('ord_123');
    });

    it('should return null for non-existent order', async () => {
      mockPrismaClient.order.findUnique.mockResolvedValue(null);

      const result = await service.getOrderById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status to PAID', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PAID' as const,
        customerEmail: 'test@example.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateOrderStatus('ord_123', 'PAID');

      expect(result?.status).toBe('PAID');
    });

    it('should update order status to CANCELED', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'CANCELED' as const,
        customerEmail: 'test@example.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateOrderStatus('ord_123', 'CANCELED');

      expect(result?.status).toBe('CANCELED');
    });
  });

  describe('updatePaymentId', () => {
    it('should update payment id for order', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@example.com',
        paymentId: 'pay_456',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.update.mockResolvedValue(mockOrder);

      const result = await service.updatePaymentId('ord_123', 'pay_456');

      expect(result?.paymentId).toBe('pay_456');
    });
  });

  describe('updateIdempotencyKey', () => {
    it('should update idempotency key', async () => {
      const mockOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@example.com',
        paymentId: null,
        idempotencyKey: 'idem_789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateIdempotencyKey('ord_123', 'idem_789');

      expect(result?.idempotencyKey).toBe('idem_789');
    });
  });
});
