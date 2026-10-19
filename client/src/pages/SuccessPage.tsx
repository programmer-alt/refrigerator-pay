import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import './ResultPage.css';

export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const [order, setOrder] = useState<{ status: string; title: string; price: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    api.orders
      .getById(orderId)
      .then((data) => {
        setOrder({
          status: data.status,
          title: data.title,
          price: data.price,
        });
      })
      .catch(() => {
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  if (loading) {
    return (
      <div className="result-page">
        <div className="result-page__inner">
          <p className="result-page__loading">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="result-page">
        <div className="result-page__inner">
          <p className="result-page__error">Заказ не найден</p>
          <a href="/" className="result-page__back">
            <ArrowLeft size={16} />
            Вернуться в магазин
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="result-page">
      <div className="result-page__inner">
        <CheckCircle className="result-page__icon" size={56} />
        <h1 className="result-page__title">Заказ оформлен!</h1>
        <p className="result-page__subtitle">Оплата прошла успешно</p>

        <div className="result-page__card">
          <div className="result-page__row">
            <span className="result-page__label">Товар</span>
            <span className="result-page__value">{order.title}</span>
          </div>
          <div className="result-page__row">
            <span className="result-page__label">Сумма</span>
            <span className="result-page__value">
              {order.price.toLocaleString('ru-RU')} RUB
            </span>
          </div>
          <div className="result-page__row">
            <span className="result-page__label">Статус</span>
            <StatusBadge status={order.status as 'PAID'} />
          </div>
        </div>

        <a href="/" className="result-page__back">
          <ArrowLeft size={16} />
          Вернуться в магазин
        </a>
      </div>
    </div>
  );
}
