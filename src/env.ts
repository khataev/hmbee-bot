import dotenv from 'dotenv';
import { z } from 'zod';

export function loadEnv() {
  dotenv.config();
}

const TochkaEnvSchema = z.object({
  TOCHKA_COOKIE: z.string().min(1, 'TOCHKA_COOKIE is required')
});

export function validateTochkaEnv() {
  const result = TochkaEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Missing or invalid environment variables for Tochka: ${missing}.\n` +
        'Remediation: Ensure you have a .env file in the root directory with TOCHKA_COOKIE defined.'
    );
  }
  return result.data;
}
