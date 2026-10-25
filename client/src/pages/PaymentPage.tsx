import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, CreditCard, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import './PaymentPage.css';

interface OrderInfo {
  title: string;
  price: number;
  currency: string;
}

/**
 * Страница оплаты (PCI DSS compliant).
 *
 * 🔴 НЕ отправляет полные номера карт на сервер.
 * Клиент генерирует cardLast4 и outcome (success/fail) локально.
 */
export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId') || '';

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Поля карты — используются только локально для UI
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    api.orders
      .getById(orderId)
      .then((data) => {
        setOrder({
          title: data.title,
          price: data.price,
          currency: data.currency,
        });
      })
      .catch(() => {
        setError('Заказ не найден');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId, navigate]);

  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '').substring(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 2);
    if (parseInt(value, 10) > 12) {
      setExpiryMonth('12');
    } else {
      setExpiryMonth(value);
    }
  };

  const handleExpiryYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 2);
    setExpiryYear(value);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvv(e.target.value.replace(/\D/g, '').substring(0, 3));
  };

  /**
   * Отправка платежа на сервер.
   *
   * 🔴 Отправляем только cardLast4 и outcome.
   * Полные реквизиты карты НЕ отправляются на сервер.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      const cleanedCard = cardNumber.replace(/\D/g, '');
      const cardLast4 = cleanedCard.slice(-4);

      // Определяем outcome на основе валидации на клиенте
      // Для mock-режима: если номер карты валидный по Луну — success, иначе fail
      const isValid = luhnCheck(cleanedCard);
      const outcome = isValid ? 'success' : 'fail';

      await api.payments.processMockPayment({
        orderId,
        cardLast4,
        outcome,
      });

      // Перенаправление на страницу чека
      navigate(`/receipt/${orderId}?cardLast4=${cardLast4}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка обработки платежа';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Алгоритм Луна для валидации номера карты на клиенте.
   */
  function luhnCheck(cardNumber: string): boolean {
    if (cardNumber.length < 13 || cardNumber.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  // Подсказки для тестовых карт (валидные по алгоритму Луна)
  const testCards = [
    { number: '4111 1111 1111 1111', bank: 'SberBank' },
    { number: '5213 0000 0000 0002', bank: 'Tinkoff' },
    { number: '2200 0000 0000 0003', bank: 'VTB' },
    { number: '5469 0000 0000 0003', bank: 'Alfa-Bank' },
  ];

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-page__loader">Загрузка данных заказа...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="payment-page">
        <div className="payment-page__error-state">
          <p>Заказ не найден</p>
          <a href="/" className="payment-page__back-link">
            <ArrowLeft size={16} />
            Вернуться в магазин
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-page__container">
        {/* Header */}
        <div className="payment-page__header">
          <ShieldCheck size={20} className="payment-page__lock-icon" />
          <span className="payment-page__secure-text">Безопасное соединение</span>
        </div>

        {/* Order Summary */}
        <div className="payment-page__order-summary">
          <h2 className="payment-page__order-title">Ваш заказ</h2>
          <div className="payment-page__order-details">
            <span className="payment-page__order-item">{order.title}</span>
            <span className="payment-page__order-amount">
              {order.price.toLocaleString('ru-RU')} {order.currency}
            </span>
          </div>
        </div>

        {/* Payment Form */}
        <div className="payment-page__form-card">
          <div className="payment-page__form-header">
            <CreditCard size={24} className="payment-page__form-icon" />
            <h2 className="payment-page__form-title">Данные карты</h2>
          </div>

          <form onSubmit={handleSubmit} className="payment-page__form">
            {/* Card Number */}
            <div className="payment-page__field">
              <label className="payment-page__label" htmlFor="cardNumber">
                Номер карты
              </label>
              <input
                id="cardNumber"
                type="text"
                className={`payment-page__input ${error ? 'payment-page__input--error' : ''}`}
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={handleCardNumberChange}
                disabled={processing}
                required
              />
            </div>

            {/* Card Holder */}
            <div className="payment-page__field">
              <label className="payment-page__label" htmlFor="cardHolder">
                Владелец карты
              </label>
              <input
                id="cardHolder"
                type="text"
                className={`payment-page__input ${error ? 'payment-page__input--error' : ''}`}
                placeholder="IVAN IVANOV"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                disabled={processing}
                required
              />
            </div>

            {/* Expiry + CVV */}
            <div className="payment-page__fields-row">
              <div className="payment-page__field">
                <label className="payment-page__label" htmlFor="expiryMonth">
                  Срок (MM/YY)
                </label>
                <div className="payment-page__expiry-row">
                  <input
                    id="expiryMonth"
                    type="text"
                    className="payment-page__input payment-page__input--small"
                    placeholder="MM"
                    value={expiryMonth}
                    onChange={handleExpiryMonthChange}
                    disabled={processing}
                    required
                  />
                  <span className="payment-page__expiry-separator">/</span>
                  <input
                    id="expiryYear"
                    type="text"
                    className="payment-page__input payment-page__input--small"
                    placeholder="YY"
                    value={expiryYear}
                    onChange={handleExpiryYearChange}
                    disabled={processing}
                    required
                  />
                </div>
              </div>

              <div className="payment-page__field">
                <label className="payment-page__label" htmlFor="cvv">
                  CVV
                </label>
                <input
                  id="cvv"
                  type="password"
                  className={`payment-page__input payment-page__input--small ${error ? 'payment-page__input--error' : ''}`}
                  placeholder="•••"
                  value={cvv}
                  onChange={handleCvvChange}
                  disabled={processing}
                  required
                  maxLength={3}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="payment-page__form-error">
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`payment-page__submit-btn ${processing ? 'payment-page__submit-btn--loading' : ''}`}
              disabled={processing}
            >
              {processing ? (
                <>
                  <span className="payment-page__spinner" />
                  Обработка платежа...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Оплатить {order.price.toLocaleString('ru-RU')} {order.currency}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Test Cards Hint */}
        <div className="payment-page__test-cards">
          <p className="payment-page__test-cards-title">Тестовые номера карт (валидные по Луну):</p>
          <div className="payment-page__test-cards-grid">
            {testCards.map((tc) => (
              <button
                key={tc.number}
                type="button"
                className="payment-page__test-card-btn"
                onClick={() => setCardNumber(tc.number)}
                disabled={processing}
              >
                {tc.bank}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="payment-page__footer">
          <a href="/" className="payment-page__back-link">
            <ArrowLeft size={16} />
            Вернуться к покупкам
          </a>
          <div className="payment-page__secure-footer">
            <Lock size={12} />
            <span>Защищено 256-bit SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
