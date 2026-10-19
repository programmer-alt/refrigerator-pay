import { Router, type Request, type Response } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const paymentController = new PaymentController();

router.post('/create-intent', (req: Request, res: Response) =>
  paymentController.createPaymentIntent(req, res)
);

router.post('/webhook', (req: Request, res: Response) =>
  paymentController.handleWebhook(req, res)
);

export default router;
