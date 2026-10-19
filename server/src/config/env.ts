import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  databaseUrl: string;
  clientUrl: string;
  paymentMode: 'mock' | 'yookassa';
  yookassa: {
    shopId: string;
    secretKey: string;
  };
}

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name];
  if (!value && fallback !== undefined) {
    return fallback;
  }
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config: Config = {
  port: parseInt(getEnvVar('PORT', '5000'), 10),
  databaseUrl: getEnvVar('DATABASE_URL'),
  clientUrl: getEnvVar('CLIENT_URL', 'http://localhost:5173'),
  paymentMode: (getEnvVar('PAYMENT_MODE', 'mock') as 'mock' | 'yookassa') || 'mock',
  yookassa: {
    shopId: getEnvVar('YOOKASSA_SHOP_ID'),
    secretKey: getEnvVar('YOOKASSA_SECRET_KEY'),
  },
};
