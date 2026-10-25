export interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  description: string;
  specs: Spec[];
  rating: number;
  reviews: number;
}

export interface Spec {
  label: string;
  value: string;
}

export interface Order {
  id: string;
  title: string;
  price: number;
  currency: string;
  status: OrderStatus;
  customerEmail: string;
  paymentId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELED';

export interface CreateOrderPayload {
  productId: string;
  customerEmail: string;
}

export interface CreatePaymentPayload {
  orderId: string;
}

export interface CreatePaymentResponse {
  confirmationUrl: string;
  orderId: string;
}

export interface MockPaymentPayload {
  orderId: string;
  cardLast4: string;
  outcome: 'success' | 'fail';
}

export interface ReceiptData {
  orderId: string;
  paymentId: string;
  transactionId: string;
  title: string;
  price: number;
  currency: string;
  cardLast4: string;
  cardHolder: string;
  paymentDate: string;
  status: string;
  event: string;
  customerEmail?: string;
}
