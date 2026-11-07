/* Subscriptions through the App Store and Google Play, managed by RevenueCat.
 * Products: Pro ($2/month) unlocks entitlement "pro"; Team ($21/month) unlocks "team".
 * The server learns about purchases from RevenueCat's webhook; the app also reads entitlements directly.
 */
import type { Plan } from '@ugent/core';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_RC_IOS_KEY, android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY }) ?? '';
export const purchasesAvailable = () => Platform.OS !== 'web' && !!KEY;

// Loaded lazily so web previews and offline builds without keys never touch the native module.
const sdk = () => (require('react-native-purchases') as typeof import('react-native-purchases')).default;

export async function initPurchases(userId: string) {
  if (!purchasesAvailable()) return;
  const P = sdk();
  if (await P.isConfigured()) await P.logIn(userId);
  else P.configure({ apiKey: KEY, appUserID: userId });
}

export const planFrom = (info: CustomerInfo): Plan =>
  info.entitlements.active.team ? 'team' : info.entitlements.active.pro ? 'pro' : 'free';

export async function getPackages(): Promise<Partial<Record<'pro' | 'team', PurchasesPackage>>> {
  if (!purchasesAvailable()) return {};
  const offerings = await sdk().getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const find = (word: string) => pkgs.find((p) => p.identifier.toLowerCase().includes(word) || p.product.identifier.toLowerCase().includes(word));
  return { pro: find('pro'), team: find('team') };
}

export async function buy(pkg: PurchasesPackage): Promise<Plan> {
  const { customerInfo } = await sdk().purchasePackage(pkg);
  return planFrom(customerInfo);
}

export async function restore(): Promise<Plan> {
  return planFrom(await sdk().restorePurchases());
}
