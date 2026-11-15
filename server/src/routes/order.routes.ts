import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';

const router = Router();
const orderService = new OrderService();
const catalogService = new CatalogService();
const orderController = new OrderController(orderService, catalogService);

router.post('/', (req, res) => orderController.createOrder(req, res));
router.get('/:id', (req, res) => orderController.getOrderById(req, res));

export default router;
