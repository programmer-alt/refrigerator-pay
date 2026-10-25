import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import './ResultPage.css';

/**
 * Страница успеха после оплаты в ЮKassa.
 *
 * ⚡ Smart polling: если статус PENDING, опрашивает сервер каждые 1.5 сек (макс 5 попыток).
 * Параллельно на бэкенде при PENDING синхронизируется с ЮKassa.
 */
export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const [order, setOrder] = useState<{ status: string; title: string; price: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLL_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 1500;

  const fetchOrderStatus = async () => {
    try {
      const data = await api.payments.getOrderStatus(orderId);
      setOrder({
        status: data.status,
        title: order?.title || '',
        price: order?.price || 0,
      });

      // Если статус изменился на PAID или CANCELED — останавливаем polling
      if (data.status !== 'PENDING') {
        setPollCount(MAX_POLL_ATTEMPTS); // Force exit
      } else {
        setPollCount((prev) => prev + 1);
      }
    } catch {
      // Если не удалось получить статус — оставляем текущий
    }
  };

  useEffect(() => {
    if (!orderId) return;

    // Первичная загрузка
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
        // Ignored — polling will handle it
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  // Smart polling: если статус PENDING и не превысили лимит попыток
  useEffect(() => {
    if (!orderId || order?.status !== 'PENDING') return;
    if (pollCount >= MAX_POLL_ATTEMPTS) return;

    const interval = setInterval(() => {
      fetchOrderStatus();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [orderId, order?.status, pollCount]);

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
