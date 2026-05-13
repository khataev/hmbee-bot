import dotenv from 'dotenv';
import { z } from 'zod';

export function loadEnv() {
  dotenv.config({ quiet: true });
}

const TochkaEnvSchema = z.object({
  TOCHKA_COOKIE: z.string().min(1, 'TOCHKA_COOKIE is required'),
  TOCHKA_CUSTOMER_ID: z.string().min(1, 'TOCHKA_CUSTOMER_ID is required')
});

const HoneyMoneyEnvSchema = z.object({
  HM_USER_EMAIL: z.string().min(1, 'HM_USER_EMAIL is required'),
  HM_USER_TOKEN: z.string().min(1, 'HM_USER_TOKEN is required'),
  HM_API_BASE_URL: z.string().min(1, 'HM_API_BASE_URL is required'),
  HM_SOURCE: z.string().min(1, 'HM_SOURCE is required'),
  HM_COOKIE: z.string().min(1, 'HM_COOKIE is required')
});

export type THoneyMoneyEnvSchema = z.infer<typeof HoneyMoneyEnvSchema>;

export function validateTochkaEnv() {
  const result = TochkaEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Missing or invalid environment variables for Tochka: ${missing}.\n` +
        'Remediation: Ensure you have a .env file in the root directory with TOCHKA_COOKIE and TOCHKA_CUSTOMER_ID defined.'
    );
  }
  return result.data;
}

export function validateHoneyMoneyEnv() {
  const result = HoneyMoneyEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Missing or invalid environment variables for Honey Money: ${missing}.\n` +
        'Remediation: Ensure you have a .env file in the root directory with HM_USER_EMAIL and HM_USER_TOKEN defined.'
    );
  }

  return result.data;
}
