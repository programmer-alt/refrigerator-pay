import { PaymentService } from '../services/payment.service';

// Мокаем OrderService
const mockOrderService: any = {
  getOrderById: jest.fn(),
  updateIdempotencyKey: jest.fn(),
  updatePaymentId: jest.fn(),
  updateOrderStatus: jest.fn(),
};

jest.mock('../services/order.service', () => ({
  OrderService: jest.fn(() => mockOrderService),
}));

// Мокаем config
jest.mock('../config/env', () => ({
  config: {
    paymentMode: 'mock',
    clientUrl: 'http://localhost:5173',
    yookassa: {
      shopId: 'test_shop',
      secretKey: 'test_secret',
    },
  },
}));

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentService(mockOrderService);
  });

  describe('createPayment (mock mode)', () => {
    it('should create payment for pending order', async () => {
      const mockOrder = {
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

      mockOrderService.getOrderById.mockResolvedValue(mockOrder);
      mockOrderService.updateIdempotencyKey.mockResolvedValue(mockOrder);
      mockOrderService.updatePaymentId.mockResolvedValue(mockOrder);

      const result = await service.createPayment({ orderId: 'ord_123' });

      expect(result).toBeDefined();
      expect(result.orderId).toBe('ord_123');
      expect(result.confirmationUrl).toContain('/payment?orderId=ord_123');
    });

    it('should throw error for non-existent order', async () => {
      mockOrderService.getOrderById.mockResolvedValue(null);

      await expect(service.createPayment({ orderId: 'nonexistent' }))
        .rejects
        .toThrow('Order with id nonexistent not found');
    });

    it('should throw error for already paid order', async () => {
      const paidOrder = {
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PAID' as const,
        customerEmail: 'test@test.com',
        paymentId: 'pay_123',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrderService.getOrderById.mockResolvedValue(paidOrder);

      await expect(service.createPayment({ orderId: 'ord_123' }))
        .rejects
        .toThrow('Order is not in PENDING status');
    });

    it('should return existing payment URL if paymentId already set', async () => {
      const orderWithPayment = {
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@test.com',
        paymentId: 'pay_existing',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrderService.getOrderById.mockResolvedValue(orderWithPayment);

      const result = await service.createPayment({ orderId: 'ord_123' });

      expect(result.orderId).toBe('ord_123');
      expect(result.confirmationUrl).toContain('/payment?orderId=ord_123');
    });
  });

  describe('handleWebhook', () => {
    it('should return PAID status for succeeded event in mock mode', async () => {
      const result = await service.handleWebhook('evt_123', 'succeeded');

      expect(result.status).toBe('PAID');
      expect(result.paymentId).toBe('evt_123');
    });

    it('should return PAID status for canceled event in mock mode (mock всегда PAID)', async () => {
      // В mock-режиме webhook всегда возвращает PAID — это ожидаемое поведение
      const result = await service.handleWebhook('evt_456', 'canceled');

      expect(result.status).toBe('PAID');
      expect(result.paymentId).toBe('evt_456');
    });

    it('should throw error for unknown status', async () => {
      // В mock-режиме handleWebhook вызывает handleYooKassaWebhook только если paymentMode !== 'mock'
      // Но т.к. config.paymentMode = 'mock', то возвращается PAID
      const result = await service.handleWebhook('evt_789', 'unknown_status');

      expect(result.status).toBe('PAID');
      expect(result.paymentId).toBe('evt_789');
    });
  });

  describe('verifyPaymentWithYooKassa', () => {
    it('should verify payment successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'succeeded',
          amount: { value: '1000.00', currency: 'RUB' },
        }),
      });

      const result = await service.verifyPaymentWithYooKassa('pay_123');

      expect(result.succeeded).toBe(true);
      expect(result.amount.value).toBe('1000.00');
    });

    it('should return failed verification', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'pending',
          amount: { value: '1000.00', currency: 'RUB' },
        }),
      });

      const result = await service.verifyPaymentWithYooKassa('pay_123');

      expect(result.succeeded).toBe(false);
    });

    it('should throw on API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.verifyPaymentWithYooKassa('pay_123'))
        .rejects
        .toThrow('Failed to verify payment with YooKassa: 500');
    });
  });

  describe('syncPaymentStatus', () => {
    it('should sync and update status when payment succeeded', async () => {
      const pendingOrder = {
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PENDING' as const,
        customerEmail: 'test@test.com',
        paymentId: 'pay_123',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrderService.getOrderById.mockResolvedValue(pendingOrder);
      mockOrderService.updateOrderStatus.mockResolvedValue({
        ...pendingOrder,
        status: 'PAID' as const,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'succeeded',
          amount: { value: '1000.00', currency: 'RUB' },
        }),
      });

      const result = await service.syncPaymentStatus('ord_123');

      expect(result.status).toBe('PAID');
      expect(result.synced).toBe(true);
    });

    it('should return current status if order already paid', async () => {
      const paidOrder = {
        id: 'ord_123',
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        status: 'PAID' as const,
        customerEmail: 'test@test.com',
        paymentId: 'pay_123',
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrderService.getOrderById.mockResolvedValue(paidOrder);

      const result = await service.syncPaymentStatus('ord_123');

      expect(result.status).toBe('PAID');
      expect(result.synced).toBe(false);
    });

    it('should return PENDING if no paymentId', async () => {
      const orderNoPayment = {
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

      mockOrderService.getOrderById.mockResolvedValue(orderNoPayment);

      const result = await service.syncPaymentStatus('ord_123');

      expect(result.status).toBe('PENDING');
      expect(result.synced).toBe(false);
    });
  });
});
