import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { OrderStatus } from '../types';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: {
    label: 'Ожидает оплаты',
    icon: <Clock size={14} />,
    color: '#f59e0b',
  },
  PAID: {
    label: 'Оплачен',
    icon: <CheckCircle2 size={14} />,
    color: '#22c55e',
  },
  CANCELED: {
    label: 'Отменён',
    icon: <XCircle size={14} />,
    color: '#ef4444',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className="status-badge" style={{ '--badge-color': config.color } as React.CSSProperties}>
      {config.icon}
      {config.label}
    </span>
  );
}
