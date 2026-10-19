import { useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { OrderModal } from '../components/OrderModal';
import type { Product } from '../types';
import './ShopPage.css';

const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Двухкамерный холодильник NoFrost',
    price: 45990,
    currency: 'RUB',
    image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&h=400&fit=crop',
    description:
      'Просторный холодильник с технологией No Frost. Автоматическое размораживание обеих камер.',
    specs: [
      { label: 'No Frost', value: 'Да' },
      { label: 'Класс', value: 'A++' },
      { label: 'Объём', value: '320 л' },
    ],
    rating: 4.8,
    reviews: 234,
  },
  {
    id: 'prod-2',
    title: 'Холодильник Side-by-Side с диспенсером',
    price: 89990,
    currency: 'RUB',
    image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&h=400&fit=crop',
    description:
      'Премиальный холодильник формата Side-by-Side. Диспенсер для воды и льда.',
    specs: [
      { label: 'No Frost', value: 'Да' },
      { label: 'Класс', value: 'A+' },
      { label: 'Объём', value: '450 л' },
    ],
    rating: 4.9,
    reviews: 156,
  },
  {
    id: 'prod-3',
    title: 'Компактный холодильник с нижней морозильной камерой',
    price: 32490,
    currency: 'RUB',
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&h=400&fit=crop',
    description:
      'Энергоэффективный холодильник с расположением морозилки внизу. Тихая работа.',
    specs: [
      { label: 'No Frost', value: 'Нет' },
      { label: 'Класс', value: 'A+++' },
      { label: 'Объём', value: '260 л' },
    ],
    rating: 4.6,
    reviews: 89,
  },
];

export function ShopPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <div className="shop-page">
      <div className="shop-page__hero">
        <h1 className="shop-page__title">Бытовая техника с доставкой</h1>
        <p className="shop-page__subtitle">
          Лучшие холодильники по выгодным ценам. Оплата в один клик.
        </p>
      </div>

      <div className="shop-page__grid">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} onBuy={setSelectedProduct} />
        ))}
      </div>

      {selectedProduct && (
        <OrderModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
