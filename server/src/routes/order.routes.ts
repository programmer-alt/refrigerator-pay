import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

const router = Router();
const orderController = new OrderController();

router.post('/', (req, res) => orderController.createOrder(req, res));
router.get('/:id', (req, res) => orderController.getOrderById(req, res));

export default router;
