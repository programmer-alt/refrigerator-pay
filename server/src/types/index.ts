export interface CreateOrderInput {
  productId: string;
  customerEmail: string;
}

export interface OrderDto {
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

export interface CreatePaymentInput {
  orderId: string;
}

export interface CreatePaymentResponse {
  confirmationUrl: string;
  orderId: string;
}

export interface MockPaymentInput {
  orderId: string;
  cardLast4: string;
  outcome: 'success' | 'fail';
}

export interface MockPaymentResponse {
  success: boolean;
  paymentId: string;
  transactionId: string;
  orderId: string;
  message?: string;
}

export interface ReceiptResponse {
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

export interface WebhookPaymentData {
  id: string;
  status: string;
  order_id: string;
  metadata: Record<string, string>;
  amount: { value: string; currency: string };
  description: string;
  recipient: { id: string };
  created_at: string;
  test: boolean;
  paid: boolean;
  reconciliation_date: string | null;
  expires_at: string | null;
  confirmation: {
    type: string;
    confirmation_url: string;
  };
}

export interface WebhookEvent {
  type: string;
  event: string;
  event_data: WebhookPaymentData;
}

export interface Spec {
  label: string;
  value: string;
}

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
