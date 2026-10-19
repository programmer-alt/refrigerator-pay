import type { Product } from '../types';

const CATALOG: Product[] = [
  {
    id: 'prod-1',
    title: 'Двухкамерный холодильник NoFrost',
    price: 45990,
    currency: 'RUB',
  },
  {
    id: 'prod-2',
    title: 'Холодильник Side-by-Side с диспенсером',
    price: 89990,
    currency: 'RUB',
  },
  {
    id: 'prod-3',
    title: 'Компактный холодильник с нижней морозильной камерой',
    price: 32490,
    currency: 'RUB',
  },
];

export class CatalogService {
  getProductById(id: string): Product | undefined {
    return CATALOG.find((p) => p.id === id);
  }
}
