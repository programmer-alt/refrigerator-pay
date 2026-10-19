import express from 'express';
import type { Request, Response } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = express.Router();
const paymentController = new PaymentController();

router.post('/create-intent', (req: Request, res: Response) =>
  paymentController.createPaymentIntent(req, res)
);

// Webhook требует raw body для проверки Content-MD5 подписи
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => paymentController.handleWebhook(req, res)
);

export default router;
