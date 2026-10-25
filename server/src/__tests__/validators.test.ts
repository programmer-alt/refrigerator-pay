import {
  validate,
  createOrderInputSchema,
  createPaymentInputSchema,
  mockPaymentInputSchema,
  webhookInputSchema,
} from '../validators';

describe('Zod Validators', () => {
  describe('createOrderInputSchema', () => {
    it('should validate correct input', () => {
      const result = validate(createOrderInputSchema, {
        productId: 'prod-1',
        customerEmail: 'test@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productId).toBe('prod-1');
        expect(result.data.customerEmail).toBe('test@example.com');
      }
    });

    it('should reject missing productId', () => {
      const result = validate(createOrderInputSchema, {
        customerEmail: 'test@example.com',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('productId');
      }
    });

    it('should reject invalid email', () => {
      const result = validate(createOrderInputSchema, {
        productId: 'prod-1',
        customerEmail: 'not-an-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('email');
      }
    });

    it('should reject empty productId', () => {
      const result = validate(createOrderInputSchema, {
        productId: '',
        customerEmail: 'test@example.com',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const result = validate(createOrderInputSchema, {
        productId: 'prod-1',
        customerEmail: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createPaymentInputSchema', () => {
    it('should validate correct input', () => {
      const result = validate(createPaymentInputSchema, {
        orderId: 'ord_123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing orderId', () => {
      const result = validate(createPaymentInputSchema, {});

      expect(result.success).toBe(false);
    });

    it('should reject empty orderId', () => {
      const result = validate(createPaymentInputSchema, {
        orderId: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('mockPaymentInputSchema', () => {
    it('should validate correct input', () => {
      const result = validate(mockPaymentInputSchema, {
        orderId: 'ord_123',
        cardLast4: '4242',
        outcome: 'success',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid cardLast4 (too short)', () => {
      const result = validate(mockPaymentInputSchema, {
        orderId: 'ord_123',
        cardLast4: '12',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid cardLast4 (letters)', () => {
      const result = validate(mockPaymentInputSchema, {
        orderId: 'ord_123',
        cardLast4: 'abcd',
        outcome: 'success',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid outcome', () => {
      const result = validate(mockPaymentInputSchema, {
        orderId: 'ord_123',
        cardLast4: '4242',
        outcome: 'invalid',
      });

      expect(result.success).toBe(false);
    });

    it('should accept fail outcome', () => {
      const result = validate(mockPaymentInputSchema, {
        orderId: 'ord_123',
        cardLast4: '0000',
        outcome: 'fail',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('webhookInputSchema', () => {
    it('should validate correct webhook input', () => {
      const result = validate(webhookInputSchema, {
        id: 'evt_123',
        status: 'succeeded',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing event id', () => {
      const result = validate(webhookInputSchema, {
        status: 'succeeded',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing status', () => {
      const result = validate(webhookInputSchema, {
        id: 'evt_123',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validate helper function', () => {
    it('should return success object on valid data', () => {
      const result = validate(createOrderInputSchema, {
        productId: 'prod-1',
        customerEmail: 'test@test.com',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
    });

    it('should return error object on invalid data', () => {
      const result = validate(createOrderInputSchema, {
        productId: '',
        customerEmail: '',
      });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });
  });
});
