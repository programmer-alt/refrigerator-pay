import type {
  CreateOrderPayload,
  CreatePaymentPayload,
  CreatePaymentResponse,
  MockPaymentPayload,
  ReceiptData,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  products: {
    getAll(): Promise<import('../types').Product[]> {
      return fetchJson<import('../types').Product[]>('/products');
    },
  },

  orders: {
    create(payload: CreateOrderPayload): Promise<import('../types').Order> {
      return fetchJson<import('../types').Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getById(id: string): Promise<import('../types').Order> {
      return fetchJson<import('../types').Order>(`/orders/${id}`);
    },
  },

  payments: {
    createIntent(payload: CreatePaymentPayload): Promise<CreatePaymentResponse> {
      return fetchJson<CreatePaymentResponse>('/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    processMockPayment(payload: MockPaymentPayload): Promise<{
      success: boolean;
      paymentId: string;
      transactionId: string;
      orderId: string;
    }> {
      return fetchJson<never>('/payments/mock/process', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getReceipt(
      orderId: string,
      cardLast4: string,
      cardHolder: string
    ): Promise<ReceiptData> {
      const params = new URLSearchParams({
        cardLast4,
        cardHolder,
      });
      return fetchJson<ReceiptData>(`/payments/mock/receipt/${orderId}?${params}`);
    },
  },
};
