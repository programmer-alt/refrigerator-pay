# FrigoShop — Интернет-магазин бытовой техники

Пет-проект интернет-магазина холодильников с интеграцией онлайн-оплаты ЮKassa.

## Стек

- **Backend:** Node.js, Express, TypeScript, Prisma ORM (SQLite), CORS, dotenv, uuid
- **Frontend:** React (Vite), TypeScript, Lucide-react, чистый CSS
- **Платежи:** ЮKassa (заготовка с моковым режимом)

## Структура проекта

```
refrigerator-pay/
├── server/                 # Backend (Express + TypeScript)
│   ├── prisma/
│   │   └── schema.prisma   # Модель Order + миграции
│   ├── src/
│   │   ├── config/         # Настройки и переменные окружения
│   │   ├── controllers/    # Контроллеры (order, payment)
│   │   ├── services/       # Бизнес-логика (order, payment)
│   │   ├── routes/         # API роуты
│   │   ├── types/          # TypeScript типы и DTO
│   │   └── index.ts        # Точка входа
│   ├── .env.example
│   └── package.json
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # ProductCard, Header, OrderModal, StatusBadge
│   │   ├── pages/          # ShopPage, SuccessPage, CancelPage
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
| POST | `/api/payments/webhook` | Вебхук ЮKassa (payment.succeeded / payment.canceled) |

## Интеграция с ЮKassa

В файле `server/src/services/payment.service.ts` находится заготовка для интеграции:

1. Раскомментируйте блок `TODO` в методе `createPayment`
2. Заполните `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` в `.env`
3. Активируйте реальные webhook-URL в кабинете ЮKassa
4. В `payment.controller.ts` раскомментируйте обновление статуса заказа из webhook

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
