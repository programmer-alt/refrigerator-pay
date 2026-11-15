import { MockPaymentService } from '../services/mock-payment.service';
import { OrderService } from '../services/order.service';

describe('MockPaymentService', () => {
  let service: MockPaymentService;
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
    service = new MockPaymentService(orderService);
  });

  describe('processPayment', () => {
    it('should process successful payment', async () => {
      const order = await orderService.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const result = await service.processPayment({
        orderId: order.id,
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.paymentId).toMatch(/^mock_pay_/);
      expect(result.transactionId).toMatch(/^txn_/);
    });

    it('should fail for non-existent order', async () => {
      const result = await service.processPayment({
        orderId: 'ord_nonexistent',
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Заказ не найден');
    });

    it('should fail for already paid order', async () => {
      const order = await orderService.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      await orderService.updateOrderStatus(order.id, 'PAID');

      const result = await service.processPayment({
        orderId: order.id,
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Заказ уже обработан');
    });

    it('should fail with invalid cardLast4 format', async () => {
      const order = await orderService.createOrder({
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@test.com',
      });

      const result = await service.processPayment({
        orderId: order.id,
        cardLast4: '12', // Too short
        outcome: 'success',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Неверный формат последних 4 цифр карты');
    });

    it('should process failed payment', async () => {
      const order = await orderService.createOrder({
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@test.com',
      });

      const result = await service.processPayment({
        orderId: order.id,
        cardLast4: '0000',
        outcome: 'fail',
      });

      expect(result.success).toBe(false);

      // Order status should be CANCELED
      const updatedOrder = await orderService.getOrderById(order.id);
      expect(updatedOrder?.status).toBe('CANCELED');
    });

    it('should generate unique payment IDs', async () => {
      const order1 = await orderService.createOrder({
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'a@test.com',
      });

      const order2 = await orderService.createOrder({
        title: 'Test',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'b@test.com',
      });

      const result1 = await service.processPayment({
        orderId: order1.id,
        cardLast4: '1111',
        outcome: 'success',
      });

      const result2 = await service.processPayment({
        orderId: order2.id,
        cardLast4: '2222',
        outcome: 'success',
      });

      expect(result1.paymentId).not.toBe(result2.paymentId);
      expect(result1.transactionId).not.toBe(result2.transactionId);
    });
  });

  describe('getReceipt', () => {
    it('should return receipt for paid order', async () => {
      const order = await orderService.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      await orderService.updateOrderStatus(order.id, 'PAID');
      await orderService.updatePaymentId(order.id, 'pay_456');

      const receipt = await service.getReceipt(order.id, '4242', 'IVAN IVANOV');

      expect(receipt).toBeDefined();
      expect(receipt?.orderId).toBe(order.id);
      expect(receipt?.cardLast4).toBe('4242');
      expect(receipt?.status).toBe('succeeded');
    });

    it('should return null for non-paid order', async () => {
      const order = await orderService.createOrder({
        title: 'Test Product',
        price: 1000,
        currency: 'RUB',
        customerEmail: 'test@example.com',
      });

      const receipt = await service.getReceipt(order.id, '4242', 'IVAN IVANOV');

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
