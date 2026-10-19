import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { XCircle, ArrowLeft } from 'lucide-react';
import './ResultPage.css';

export function CancelPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const [order, setOrder] = useState<{ status: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    api.orders
      .getById(orderId)
      .then((data) => {
        setOrder({
          status: data.status,
          title: data.title,
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
        <XCircle className="result-page__icon result-page__icon--cancel" size={56} />
        <h1 className="result-page__title">Оплата отменена</h1>
        <p className="result-page__subtitle">
          Заказ «{order.title}» не был оплачен
        </p>

        <div className="result-page__card">
          <div className="result-page__row">
            <span className="result-page__label">Статус</span>
            <StatusBadge status={order.status as 'CANCELED'} />
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
