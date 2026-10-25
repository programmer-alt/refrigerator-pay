import { z } from 'zod';

/**
 * Zod-схемы для валидации входных данных API.
 *
 * Заменяют ручные проверки `if (!field)` на декларативную валидацию.
 * Все схемы экспортируются для переиспользования в контроллерах и тестах.
 */

// Email валидация
export const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Invalid email format');

// Product ID — не пустая строка
export const productIdSchema = z.string()
  .min(1, 'Product ID is required');

// Order creation input
export const createOrderInputSchema = z.object({
  productId: productIdSchema,
  customerEmail: emailSchema,
});

// Payment creation input
export const createPaymentInputSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

// Mock payment input (PCI DSS compliant)
export const mockPaymentInputSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  cardLast4: z.string()
    .regex(/^\d{4}$/, 'cardLast4 must be exactly 4 digits')
    .length(4),
  outcome: z.enum(['success', 'fail']),
});

// Webhook input (для парсинга из JSON)
export const webhookInputSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  status: z.string().min(1, 'Payment status is required'),
  metadata: z.record(z.string(), z.string()).optional(),
});

// Receipt query params
export const receiptQuerySchema = z.object({
  cardLast4: z.string().default('0000'),
  cardHolder: z.string().default(''),
});

/**
 * Валидатор с обработкой ошибок Zod.
 * Возвращает { success: true, data } или { success: false, error }.
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');

  return { success: false, error: errors };
}
