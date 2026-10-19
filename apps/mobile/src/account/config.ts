import type { DemoCredentials } from './model';
/** Public prototype values bundled by Expo. Never use production account secrets here. */
export const demoCredentials: DemoCredentials = {
  email: process.env.EXPO_PUBLIC_DEMO_EMAIL || 'syf@outlook.com',
  password: process.env.EXPO_PUBLIC_DEMO_PASSWORD || 'test001',
};
