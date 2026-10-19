import type { CreateOrderPayload, CreatePaymentPayload, CreatePaymentResponse, Order } from '../types';

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
    create(payload: CreateOrderPayload): Promise<Order> {
      return fetchJson<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getById(id: string): Promise<Order> {
      return fetchJson<Order>(`/orders/${id}`);
    },
  },

  payments: {
    createIntent(payload: CreatePaymentPayload): Promise<CreatePaymentResponse> {
      return fetchJson<CreatePaymentResponse>('/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },
};
