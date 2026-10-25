import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Download, Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { api } from '../services/api';
import './ReceiptPage.css';

interface ReceiptData {
  orderId: string;
  paymentId: string;
  transactionId: string;
  title: string;
  price: number;
  currency: string;
  cardLast4: string;
  cardHolder: string;
  paymentDate: string;
  status: string;
  event: string;
  customerEmail?: string;
}

export function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const cardLast4 = searchParams.get('cardLast4') || '0000';
    const cardHolder = searchParams.get('cardHolder') || '';

    api.payments
      .getReceipt(orderId, cardLast4, cardHolder)
      .then((data) => {
        setReceipt(data);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Не удалось загрузить чек';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId, navigate]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="receipt-page">
        <div className="receipt-page__inner">
          <div className="receipt-page__loading">Формируем чек...</div>
        </div>
      </div>
    );
  }

  if (!receipt || error) {
    return (
      <div className="receipt-page">
        <div className="receipt-page__inner">
          <p className="receipt-page__error">Ошибка загрузки чека</p>
          <button className="receipt-page__back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
            Вернуться в магазин
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt-page">
      <div className="receipt-page__inner">
        {/* Success Icon */}
        <div className="receipt-page__success-icon">
          <CheckCircle size={64} />
        </div>

        {/* Success Message */}
        <div className="receipt-page__success-message">
          <h1 className="receipt-page__title">Оплата прошла успешно!</h1>
          <p className="receipt-page__subtitle">Платеж обработан банком</p>
        </div>

        {/* Receipt Card */}
        <div className="receipt-page__card">
          <div className="receipt-page__card-header">
            <ReceiptIcon size={20} className="receipt-page__card-icon" />
            <h2 className="receipt-page__card-title">Чек об оплате</h2>
          </div>

          {/* Order Info */}
          <div className="receipt-page__section">
            <div className="receipt-page__row">
              <span className="receipt-page__label">Товар</span>
              <span className="receipt-page__value">{receipt.title}</span>
            </div>
            <div className="receipt-page__row receipt-page__row--total">
              <span className="receipt-page__label">Сумма</span>
              <span className="receipt-page__value receipt-page__value--total">
                {receipt.price.toLocaleString('ru-RU')} {receipt.currency}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="receipt-page__divider" />

          {/* Payment Details */}
          <div className="receipt-page__section">
            <h3 className="receipt-page__section-title">Детали платежа</h3>

            <div className="receipt-page__row">
              <span className="receipt-page__label">Номер заказа</span>
              <span className="receipt-page__value receipt-page__value--mono">{receipt.orderId}</span>
            </div>
            <div className="receipt-page__row">
              <span className="receipt-page__label">ID платежа</span>
              <span className="receipt-page__value receipt-page__value--mono">{receipt.paymentId}</span>
            </div>
            <div className="receipt-page__row">
              <span className="receipt-page__label">Транзакция</span>
              <span className="receipt-page__value receipt-page__value--mono">{receipt.transactionId}</span>
            </div>
            <div className="receipt-page__row">
              <span className="receipt-page__label">Дата оплаты</span>
              <span className="receipt-page__value">{formatDate(receipt.paymentDate)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="receipt-page__divider" />

          {/* Card Details */}
          <div className="receipt-page__section">
            <h3 className="receipt-page__section-title">Способ оплаты</h3>

            <div className="receipt-page__card-preview">
              <div className="receipt-page__card-preview-row">
                <span className="receipt-page__card-label">Карта</span>
                <span className="receipt-page__card-value">•••• •••• •••• {receipt.cardLast4}</span>
              </div>
              <div className="receipt-page__card-preview-row">
                <span className="receipt-page__card-label">Владелец</span>
                <span className="receipt-page__card-value">{receipt.cardHolder}</span>
              </div>
            </div>
          </div>

          {/* Customer Email (masked) */}
          {receipt.customerEmail && (
            <>
              <div className="receipt-page__divider" />
              <div className="receipt-page__section">
                <h3 className="receipt-page__section-title">Данные покупателя</h3>
                <div className="receipt-page__row">
                  <span className="receipt-page__label">Email</span>
                  <span className="receipt-page__value">{receipt.customerEmail}</span>
                </div>
              </div>
            </>
          )}

          {/* Status Badge */}
          <div className="receipt-page__status">
            <span className="receipt-page__status-dot" />
            <span className="receipt-page__status-text">{receipt.event}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="receipt-page__actions">
          <button className="receipt-page__action-btn" onClick={handlePrint}>
            <Printer size={18} />
            Распечатать
          </button>
          <button className="receipt-page__action-btn receipt-page__action-btn--primary">
            <Download size={18} />
            Скачать PDF
          </button>
        </div>

        {/* Back Link */}
        <a href="/" className="receipt-page__back-link">
          <ArrowLeft size={16} />
          Вернуться в магазин
        </a>
      </div>
    </div>
  );
}
