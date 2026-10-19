import { Star, MoveRight } from 'lucide-react';
import type { Product } from '../types';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onBuy: (product: Product) => void;
}

export function ProductCard({ product, onBuy }: ProductCardProps) {
  return (
    <div className="product-card">
      <div className="product-card__image-wrapper">
        <img src={product.image} alt={product.title} className="product-card__image" />
        <div className="product-card__badge-top">Хит продаж</div>
      </div>

      <div className="product-card__body">
        <h3 className="product-card__title">{product.title}</h3>

        <div className="product-card__rating">
          <Star className="product-card__star" />
          <span>{product.rating}</span>
          <span className="product-card__reviews">({product.reviews} отзывов)</span>
        </div>

        <div className="product-card__specs">
          {product.specs.map((spec) => (
            <span key={spec.label} className="product-card__spec">
              {spec.label}: {spec.value}
            </span>
          ))}
        </div>

        <p className="product-card__description">{product.description}</p>

        <div className="product-card__footer">
          <div className="product-card__price">
            <span className="product-card__price-value">
              {product.price.toLocaleString('ru-RU')}
            </span>
            <span className="product-card__price-currency">{product.currency}</span>
          </div>

          <button className="product-card__btn" onClick={() => onBuy(product)}>
            <MoveRight size={18} />
            Купить в 1 клик
          </button>
        </div>
      </div>
    </div>
  );
}
