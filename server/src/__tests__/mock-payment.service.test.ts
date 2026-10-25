import { MockPaymentService } from '../services/mock-payment.service';
import { mockPrismaClient } from '../__tests__/setup';

describe('MockPaymentService', () => {
  let service: MockPaymentService;

  beforeEach(() => {
    service = new MockPaymentService();
  });

  describe('processPayment', () => {
    it('should process successful payment', async () => {
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
      mockPrismaClient.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAID' as const,
        paymentId: 'mock_pay_123',
      });

      const result = await service.processPayment({
        orderId: 'ord_123',
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord_123');
      expect(result.paymentId).toMatch(/^mock_pay_/);
      expect(result.transactionId).toMatch(/^txn_/);
    });

    it('should fail for non-existent order', async () => {
      mockPrismaClient.order.findUnique.mockResolvedValue(null);

      const result = await service.processPayment({
        orderId: 'ord_nonexistent',
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Заказ не найден');
    });

    it('should fail for already paid order', async () => {
      const paidOrder = {
        id: 'ord_paid',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PAID' as const,
        customerEmail: 'test@example.com',
        paymentId: 'pay_123',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.findUnique.mockResolvedValue(paidOrder);

      const result = await service.processPayment({
        orderId: 'ord_paid',
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Заказ уже обработан');
    });

    it('should fail with invalid cardLast4 format', async () => {
      mockPrismaClient.order.findUnique.mockResolvedValue({
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@test.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.processPayment({
        orderId: 'ord_123',
        cardLast4: '12', // Too short
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Неверный формат последних 4 цифр карты');
    });

    it('should process failed payment', async () => {
      mockPrismaClient.order.findUnique.mockResolvedValue({
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@test.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.processPayment({
        orderId: 'ord_123',
        cardLast4: '0000',
        outcome: 'fail',
      });

      expect(result.success).toBe(false);
    });

    it('should generate unique payment IDs', async () => {
      const baseOrder = {
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@test.com',
        paymentId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.findUnique.mockResolvedValue(baseOrder);
      mockPrismaClient.order.update.mockResolvedValue({
        ...baseOrder,
        status: 'PAID' as const,
        paymentId: 'mock_pay_123',
      });

      const result1 = await service.processPayment({
        orderId: 'ord_123',
        cardLast4: '1111',
        outcome: 'success',
      });

      const result2 = await service.processPayment({
        orderId: 'ord_123',
        cardLast4: '2222',
        outcome: 'success',
      });

      expect(result1.paymentId).not.toBe(result2.paymentId);
      expect(result1.transactionId).not.toBe(result2.transactionId);
    });
  });

  describe('getReceipt', () => {
    it('should return receipt for paid order', async () => {
      const paidOrder = {
        id: 'ord_123',
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        status: 'PAID' as const,
        customerEmail: 'test@example.com',
        paymentId: 'pay_456',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date('2024-01-15'),
      };

      mockPrismaClient.order.findUnique.mockResolvedValue(paidOrder);

      const receipt = await service.getReceipt('ord_123', '4242', 'IVAN IVANOV');

      expect(receipt).toBeDefined();
      expect(receipt?.orderId).toBe('ord_123');
      expect(receipt?.cardLast4).toBe('4242');
      expect(receipt?.status).toBe('succeeded');
    });

    it('should return null for non-paid order', async () => {
      const pendingOrder = {
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

      mockPrismaClient.order.findUnique.mockResolvedValue(pendingOrder);

      const receipt = await service.getReceipt('ord_123', '4242', 'IVAN IVANOV');

      expect(receipt).toBeNull();
    });
  });

  describe('maskEmail', () => {
    it('should mask email correctly', () => {
      const serviceAny = service as any;
      const masked = serviceAny.maskEmail('vasya@mail.ru');
      expect(masked).toBe('v****@mail.ru');
    });

    it('should handle single char email name', () => {
      const serviceAny = service as any;
      const masked = serviceAny.maskEmail('a@test.com');
      expect(masked).toBe('a*@test.com');
    });

    it('should handle invalid email', () => {
      const serviceAny = service as any;
      const masked = serviceAny.maskEmail('invalid');
      expect(masked).toBe('***@***.***');
    });
  });
});
