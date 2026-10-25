// Глобальный мока для Prisma — должен выполняться ДО импорта сервисов
export const mockPrismaClient: any = {
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: any) => Promise<any>) => callback(mockPrismaClient)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Clear all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// No tests here — this is just setup
