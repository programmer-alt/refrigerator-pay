# FrigoShop — Интернет-магазин холодильников

Пет-проект интернет-магазина бытовой техники с полной интеграцией онлайн-оплаты (ЮKassa) и локальным эмулятором платёжного шлюза.

## 🛠 Стек технологий

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js 5
- **ORM:** Prisma (SQLite для разработки, PostgreSQL для продакшена)
- **Валидация:** Zod 4 (декларативная валидация всех входных данных)
- **Безопасность:** Helmet (HTTP headers), CORS, express-rate-limit
- **Тесты:** Jest + Supertest
- **Dev-инструменты:** tsx (hot reload), Prisma Studio

### Frontend
- **Framework:** React 19 + TypeScript
- **Build tool:** Vite 6 + @vitejs/plugin-react
- **Routing:** React Router DOM 7
- **Icons:** Lucide React
- **Стили:** Чистый CSS (BEM-подобные классы)

### Платежи
- **Боевой режим:** ЮKassa API v3 (REST, Basic Auth, Webhook)
- **Демо режим:** Mock-шлюз (эмуляция банка с задержкой 2 сек)

## 📐 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React Client)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Shop    │ │ Payment  │ │ Receipt  │ │ Success  │       │
│  │  Page    │ │  Page    │ │  Page    │ │  Page    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│         │              │              │                     │
│         └──────────────┴──────────────┘                     │
│                         │                                   │
│                   fetchJson()                               │
│                   /api/* (Vite proxy)                       │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────┼───────────────────────────────────┐
│                Backend (Express Server)                      │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │              Controllers Layer                       │   │
│  │  OrderController  │  PaymentController               │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────┴────────────────────────────────┐   │
│  │              Services Layer                          │   │
│  │  OrderService  │  PaymentService  │  CatalogService  │   │
│  │                │  (Adapter Pattern)                   │   │
│  │                │  ├── MockPaymentService              │   │
│  │                │  └── YooKassa API (direct fetch)     │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────┴────────────────────────────────┐   │
│  │              Data Access Layer                       │   │
│  │              Prisma Client                           │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│              ┌────────┴────────┐                            │
│              │   Database      │                            │
│              │  SQLite / PG    │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Слои приложения

```
Request → Middleware (Helmet, Rate Limit, CORS, Logging)
        → Router (catalog, order, payment)
        → Controller (Zod validation)
        → Service (business logic)
        → Prisma (data access)
        → Response
```

## 🏗 Структура проекта

```
refrigerator-pay/
├── server/                     # Backend (Express + TypeScript)
│   ├── prisma/
│   │   ├── schema.prisma       # Модели: Order, Payment
│   │   ├── migrations/         # Миграции Prisma
│   │   └── dev.db              # SQLite база (dev)
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts          # Конфигурация (.env)
│   │   ├── controllers/
│   │   │   ├── catalog.controller.ts
│   │   │   ├── order.controller.ts
│   │   │   └── payment.controller.ts
│   │   ├── services/
│   │   │   ├── catalog.service.ts
│   │   │   ├── order.service.ts
│   │   │   ├── payment.service.ts      # Adapter Pattern
│   │   │   └── mock-payment.service.ts # Эмулятор банка
│   │   ├── routes/
│   │   │   ├── catalog.routes.ts
│   │   │   ├── order.routes.ts
│   │   │   └── payment.routes.ts
│   │   ├── types/
│   │   │   └── index.ts          # DTO, интерфейсы
│   │   ├── validators.ts         # Zod-схемы валидации
│   │   └── index.ts              # Точка входа
│   ├── __tests__/                # Unit-тесты
│   │   ├── catalog.service.test.ts
│   │   ├── mock-payment.service.test.ts
│   │   ├── order.service.test.ts
│   │   ├── payment.service.test.ts
│   │   ├── validators.test.ts
│   │   └── setup.ts
│   ├── .env                      # Переменные окружения
│   ├── .env.example              # Шаблон .env
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.ts
├── client/                       # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx / .css
│   │   │   ├── OrderModal.tsx / .css
│   │   │   ├── ProductCard.tsx / .css
│   │   │   └── StatusBadge.tsx / .css
│   │   ├── pages/
│   │   │   ├── ShopPage.tsx          # Каталог товаров
│   │   │   ├── PaymentPage.tsx       # Страница оплаты (PCI DSS)
│   │   │   ├── ReceiptPage.tsx       # Чек об оплате
│   │   │   ├── SuccessPage.tsx       # Успешная оплата
│   │   │   ├── CancelPage.tsx        # Отмена оплаты
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── api.ts                # API-клиент (fetch wrapper)
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript типы
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── vite.config.ts              # Vite + proxy /api
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── screenshots/                # Скриншоты для README
├── package.json                    # Workspace root
└── README.md
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```powershell
# Установка всех зависимостей (workspaces)
npm install
```

### 2. Настройка базы данных

```powershell
cd server
npx prisma migrate dev --name init
```

### 3. Настройка переменных окружения

```powershell
cd server
Copy-Item .env.example .env
# Отредактируйте .env при необходимости
```

### 4. Запуск

**Вариант A — Один терминал (рекомендуется):**

```powershell
npm run dev
```

Запустит и backend (порт 5000), и frontend (порт 5173) параллельно.

**Вариант B — Два терминала:**

```powershell
# Терминал 1 — Backend
cd server
npm run dev

# Терминал 2 — Frontend
cd client
npm run dev
```

Откройте http://localhost:5173 в браузере.

## 🔌 API

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/products` | Получить каталог товаров |
| POST | `/api/orders` | Создать заказ (productId + email) |
| GET | `/api/orders/:id` | Получить статус заказа |
| POST | `/api/payments/create-intent` | Создать платёж, получить URL |
| POST | `/api/payments/mock/process` | Mock-оплата (cardLast4 + outcome) |
| GET | `/api/payments/mock/receipt/:orderId` | Данные чека |
| POST | `/api/payments/webhook` | Webhook ЮKassa |
| GET | `/api/payments/status/:orderId` | Статус заказа (polling) |
| GET | `/health` | Health check |

## 💳 Система платежей

### Adapter Pattern

```
PaymentService (Adapter)
├── PAYMENT_MODE=mock     → MockPaymentService (эмулятор банка)
└── PAYMENT_MODE=yookassa → ЮKassa API v3 (REST)
```

Переключение режима — одна переменная в `.env`:

```env
PAYMENT_MODE=mock           # ← локальный эмулятор (по умолчанию)
PAYMENT_MODE=yookassa       # ← ЮKassa
```

### Mock-шлюз (PCI DSS compliant)

- Клиент **не отправляет** полные номера карт на сервер
- На сервер уходят только `cardLast4` (4 цифры) и `outcome` (success/fail)
- Валидация номера карты по **алгоритму Луна** на клиенте
- Имитация задержки банка: **2 секунды**
- Защита от дублирования: проверка статуса заказа перед обработкой

### ЮKassa интеграция

- Создание платежа через REST API v3
- **Idempotency Key** — защита от двойных списаний
- Webhook-обработчик с верификацией подписи (Content-MD5)
- **Двойная верификация** — проверка платежа напрямую через API ЮKassa
- **Сверка сумм** — копейка в копейку (сравнение amount из webhook и заказа)
- Защита от дублирования webhook (проверка текущего статуса заказа)
- Синхронизация статуса через polling (SuccessPage)

### Тестовые карты (валидные по Луну)

| Банк | Номер |
|------|-------|
| SberBank | `4111 1111 1111 1111` |
| Tinkoff | `5213 0000 0000 0002` |
| VTB | `2200 0000 0000 0003` |
| Alfa-Bank | `5469 0000 0000 0003` |

Любой срок в будущем + любые 3 цифры CVV.

## 🔒 Безопасность

| Механизм | Реализация |
|----------|------------|
| Helmet | Защита HTTP headers (CSP, X-Frame-Options, и др.) |
| Rate Limiting | 100 запросов/15мин (общий), 10 заказов/15мин (orders) |
| CORS | Разрешён только `CLIENT_URL` |
| Zod валидация | Все входные данные валидируются декларативно |
| PCI DSS | Полные номера карт не отправляются на сервер |
| Idempotency | Ключи для защиты от двойных платежей |
| Webhook verification | Content-MD5 + двойная проверка через API |
| Amount mismatch | Сверка суммы платежа с суммой заказа |
| Email masking | Первая буква + `***@domain` в чеке |

## 🗄 Модель данных

```prisma
model Order {
  id              String       @id @default(cuid())
  title           String
  price           Decimal
  currency        String       @default("RUB")
  status          OrderStatus  @default(PENDING)
  customerEmail   String
  paymentId       String?      @unique
  idempotencyKey  String?      @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model Payment {
  id                String       @id @default(uuid())
  orderId           String
  externalPaymentId String?      @unique
  provider          String       @default("mock")
  status            OrderStatus  @default(PENDING)
  amount            Decimal
  currency          String       @default("RUB")
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}
```

**Статусы заказа:** `PENDING` → `PAID` / `CANCELED`

## 🧪 Тесты

```powershell
cd server
npm test              # Запуск тестов
npm run test:watch    # Watch-режим
npm run test:coverage # Отчёт покрытия
```

Покрытие: сервисы (Order, Payment, MockPayment, Catalog), валидаторы (Zod-схемы).

## 🔄 Переключение на PostgreSQL

Для продакшена замените провайдер в `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

И укажите строку подключения в `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/frigoship"
```

## 📱 Роуты фронтенда

| Маршрут | Страница | Описание |
|---------|----------|----------|
| `/` | ShopPage | Каталог товаров |
| `/payment?orderId=:id` | PaymentPage | Форма оплаты |
| `/receipt/:orderId` | ReceiptPage | Чек об оплате |
| `/success` | SuccessPage | Успешная оплата |
| `/cancel` | CancelPage | Отмена оплаты |

## 🏗 Паттерны проектирования

| Паттерн | Где используется |
|---------|-----------------|
| **Adapter** | PaymentService — делегирование mock/yookassa |
| **Repository** | OrderService, CatalogService — абстракция над Prisma |
| **Dependency Injection** | Сервисы принимают зависимости через конструктор (для тестирования) |
| **Validation Schema** | Zod-схемы в `validators.ts` — единая точка валидации |
| **Layered Architecture** | Controller → Service → Data Access |

## 📸 Демонстрация

### Каталог товаров
<img src="docs/screenshots/step_2.png" alt="Каталог товаров" width="600">
*Шаг 2 — Страница каталога*

### Оформление заказа
<img src="docs/screenshots/step_3.png" alt="Оформление заказа" width="600">
*Шаг 3 — Создание заказа*

### Страница оплаты
<img src="docs/screenshots/step_4.png" alt="Страница оплаты" width="600">
*Шаг 4 — Форма ввода карты (Mock-шлюз)*

### Успешная оплата
<img src="docs/screenshots/step_5.png" alt="Успешная оплата" width="600">
*Шаг 5 — Подтверждение оплаты*

### Отказ в оплате
<img src="docs/screenshots/step_6.png" alt="Недостаточно средств" width="600">
*Шаг 6 — Недостаточно средств*

### Неверные данные карты
<img src="docs/screenshots/step_7.png" alt="Неверные данные карты" width="600">
*Шаг 7 — Неверные данные карты*

## 📊 Метрики проекта

| Метрика | Значение |
|---------|----------|
| TypeScript файлы | 25 |
| TSX файлы | 11 |
| Всего строк | ~3,550 |
