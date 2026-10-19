# FrigoShop — Интернет-магазин бытовой техники

Пет-проект интернет-магазина холодильников с интеграцией онлайн-оплаты ЮKassa и локальным эмулятором платёжного шлюза.

## Стек

- **Backend:** Node.js, Express, TypeScript, Prisma ORM (SQLite), CORS, dotenv, uuid
- **Frontend:** React (Vite), TypeScript, Lucide-react, чистый CSS
- **Платежи:** ЮKassa (боевой режим) + Mock-шлюз (демо-режим)

## Структура проекта

```
refrigerator-pay/
├── server/                 # Backend (Express + TypeScript)
│   ├── prisma/
│   │   └── schema.prisma   # Модель Order + миграции
│   ├── src/
│   │   ├── config/         # Настройки и переменные окружения
│   │   ├── controllers/    # Контроллеры (order, payment)
│   │   ├── services/       # Бизнес-логика (order, payment, mock-payment)
│   │   ├── routes/         # API роуты
│   │   ├── types/          # TypeScript типы и DTO
│   │   └── index.ts        # Точка входа
│   ├── .env.example
│   └── package.json
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # ProductCard, Header, OrderModal, StatusBadge
│   │   ├── pages/          # ShopPage, PaymentPage, ReceiptPage, SuccessPage, CancelPage
│   │   ├── services/       # API-клиент
│   │   ├── types/          # TypeScript типы
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Быстрый старт

### 1. Установка зависимостей

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Настройка базы данных

```bash
cd ../server
npx prisma migrate dev --name init
```

Это создаст SQLite-базу и таблицу `orders`.

### 3. Настройка переменных окружения

```bash
cd ../server
cp .env.example .env
# Отредактируйте .env при необходимости
```

### 4. Запуск

Откройте **два терминала**:

**Терминал 1 — Backend (порт 5000):**
```bash
cd server
npm run dev
```

**Терминал 2 — Frontend (порт 5173):**
```bash
cd client
npm run dev
```

Откройте http://localhost:5173 в браузере.

## API

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/orders` | Создать черновик заказа (productId + email, цена берётся с бэкенда) |
| GET | `/api/orders/:id` | Получить статус заказа |
| POST | `/api/payments/create-intent` | Создать платёж, получить URL для оплаты |
| POST | `/api/payments/mock/process` | Обработка оплаты через Mock-шлюз (ввод карты) |
| GET | `/api/payments/mock/receipt/:orderId` | Получение данных чека после оплаты |
| POST | `/api/payments/webhook` | Вебхук ЮKassa (payment.succeeded / payment.canceled) |

## Mock-шлюз (Эмулятор платёжного провайдера)

В проекте реализован локальный эмулятор платёжного шлюза — идеальная демонстрация навыков на собеседовании.

### Как это работает

1. Пользователь нажимает «Купить» в каталоге
2. Создаётся черновик заказа (статус `PENDING`)
3. Пользователь перенаправляется на **страницу оплаты** (`/payment`) в стиле банковского шлюза
4. Вводит данные карты (номер, владелец, срок, CVV)
5. Сервер валидирует номер по **алгоритму Луна**, проверяет срок действия и CVV
6. Через **2 секунды** (имитация ответа банка) заказ переводится в статус `PAID`
7. Пользователь видит **красивый чек** (`/receipt/:orderId`) с деталями платежа

### Паттерн Adapter

```
PaymentService (Adapter)
├── PAYMENT_MODE=mock  →  MockPaymentService  (эмулятор банка)
└── PAYMENT_MODE=yookassa  →  YooKassa API  (боевой провайдер)
```

Для переключения на боевой банк достаточно изменить один флаг в `.env`:

```env
PAYMENT_MODE=mock           # ← локальный эмулятор (по умолчанию)
PAYMENT_MODE=yookassa       # ← ЮKassa
```

### Тестовые карты (валидные по Луну)

| Банк | Номер |
|------|-------|
| SberBank | `4111 1111 1111 1111` |
| Tinkoff | `5213 0000 0000 0002` |
| VTB | `2200 0000 0000 0003` |
| Alfa-Bank | `5469 0000 0000 0003` |

Любой срок действия в будущем + любые 3 цифры CVV.

### Архитектура Mock-шлюза

**Backend:**
- `services/mock-payment.service.ts` — эмулятор банка: валидация по Луну, проверка срока/CVV, задержка 2 сек, обновление статуса заказа
- `services/payment.service.ts` — Adapter: делегирует mock/yookassa в зависимости от `PAYMENT_MODE`
- `controllers/payment.controller.ts` — эндпоинты `mock/process` и `mock/receipt/:orderId`

**Frontend:**
- `pages/PaymentPage.tsx` — страница ввода карты в стиле банковского шлюза
- `pages/ReceiptPage.tsx` — чек после оплаты с деталями транзакции
- `components/OrderModal.tsx` — оформление заказа → редирект на `/payment`

## Интеграция с ЮKassa

В файле `server/src/services/payment.service.ts` находится полная интеграция с ЮKassa:

1. Установите `PAYMENT_MODE=yookassa` в `.env`
2. Заполните `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`
3. Активируйте webhook-URL в кабинете ЮKassa
4. Код уже готов — раскомментировать не нужно

## Статусы заказа

- **PENDING** — черновик, ожидает оплаты
- **PAID** — оплата прошла успешно
- **CANCELED** — оплата отменена

## Переход на PostgreSQL

Для production замените провайдер в `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

И укажите строку подключения в `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/frigoship"
```
