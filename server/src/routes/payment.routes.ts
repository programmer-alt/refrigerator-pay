import express from 'express';
import type { Request, Response } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { orderService } from './shared-services';
import { PaymentService } from '../services/payment.service';
import { MockPaymentService } from '../services/mock-payment.service';

const router = express.Router();

// Shared OrderService instance — все контроллеры используют одну Map
const paymentService = new PaymentService(orderService);
const mockPaymentService = new MockPaymentService(orderService);
const paymentController = new PaymentController(orderService, paymentService, mockPaymentService);

router.post('/create-intent', (req: Request, res: Response) =>
  paymentController.createPaymentIntent(req, res)
);

// Mock-шлюз: обработка оплаты картой
router.post('/mock/process', (req: Request, res: Response) =>
  paymentController.processMockPayment(req, res)
);

// Mock-шлюз: получение чека
router.get('/mock/receipt/:orderId', (req: Request, res: Response) =>
  paymentController.getReceipt(req, res)
);

// Получение статуса заказа для polling
router.get('/status/:orderId', (req: Request, res: Response) =>
  paymentController.getOrderStatus(req, res)
);

// Webhook требует raw body для проверки Content-MD5 подписи
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => paymentController.handleWebhook(req, res)
);

export default router;
