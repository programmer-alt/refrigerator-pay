import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Product } from '../types';
import './OrderModal.css';

interface OrderModalProps {
  product: Product;
  onClose: () => void;
}

export function OrderModal({ product, onClose }: OrderModalProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'form' | 'processing' | 'redirect' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderId, setOrderId] = useState('');

  const handleBuy = async () => {
    if (!email.trim()) {
      setErrorMessage('Введите email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Некорректный email');
      return;
    }

    setStep('processing');
    setErrorMessage('');

    try {
      // Step 1: Create order
      const order = await api.orders.create({
        title: product.title,
        price: product.price,
        currency: product.currency,
        customerEmail: email,
      });

      setOrderId(order.id);

      // Step 2: Create payment intent
      const payment = await api.payments.createIntent({ orderId: order.id });

      // Step 3: Redirect to payment
      setOrderId(payment.orderId);
      setStep('redirect');

      // Simulate redirect delay
      setTimeout(() => {
        window.location.href = payment.confirmationUrl;
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка';
      setErrorMessage(message);
      setStep('error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="modal__title">Оформление заказа</h2>

        <div className="modal__product-info">
          <span className="modal__product-name">{product.title}</span>
          <span className="modal__product-price">
            {product.price.toLocaleString('ru-RU')} {product.currency}
          </span>
        </div>

        {step === 'form' && (
          <div className="modal__form">
            <label className="modal__label" htmlFor="email">
              Email для подтверждения заказа
            </label>
            <input
              id="email"
              type="email"
              className="modal__input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={step !== 'form'}
            />

            {errorMessage && (
              <div className="modal__error">
                <AlertCircle size={16} />
                {errorMessage}
              </div>
            )}

            <button className="modal__btn" onClick={handleBuy}>
              Перейти к оплате
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="modal__processing">
            <Loader2 className="modal__spinner" size={32} />
            <p>Создаём заказ...</p>
          </div>
        )}

        {step === 'redirect' && (
          <div className="modal__redirect">
            <CheckCircle className="modal__success-icon" size={32} />
            <p>Заказ #{orderId} создан!</p>
            <p className="modal__redirect-hint">Перенаправляем на страницу оплаты...</p>
          </div>
        )}

        {step === 'error' && (
          <div className="modal__error-state">
            <AlertCircle className="modal__error-icon" size={32} />
            <p>Ошибка: {errorMessage}</p>
            <button className="modal__btn modal__btn--secondary" onClick={() => setStep('form')}>
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
