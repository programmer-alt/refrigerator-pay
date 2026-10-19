import { useState, useEffect } from 'react';
import { ProductCard } from '../components/ProductCard';
import { OrderModal } from '../components/OrderModal';
import { api } from '../services/api';
import type { Product } from '../types';
import './ShopPage.css';

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.products
      .getAll()
      .then((data) => {
        setProducts(data);
      })
      .catch(() => {
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="shop-page">
        <p className="shop-page__loading">Загрузка каталога...</p>
      </div>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-page__hero">
        <h1 className="shop-page__title">Бытовая техника с доставкой</h1>
        <p className="shop-page__subtitle">
          Лучшие холодильники по выгодным ценам. Оплата в один клик.
        </p>
      </div>

      <div className="shop-page__grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onBuy={setSelectedProduct} />
        ))}
      </div>

      {selectedProduct && (
        <OrderModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
