import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';

/**
 * Shared OrderService instance — все контроллеры используют одну Map.
 * Решает Comment 1: payments cannot find new orders.
 */
const orderService = new OrderService();
const catalogService = new CatalogService();

export { orderService, catalogService };
