import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export type LicenseState = 'NOT_ACTIVATED' | 'ACTIVATING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DEVICE_REPLACEMENT_REQUIRED' | 'NETWORK_REQUIRED' | 'SERVER_ERROR' | 'INVALID_LICENSE';
export type LicenseInfo = { customerName: string; licenseKey: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'; expiresAt?: string; deviceName: string; validatedAt: string; graceUntil?: string };
const STORAGE_KEY = 'bubo.activation.v1';
const configuredApiBase = String(Constants.expoConfig?.extra?.licenseApiBaseUrl || '').trim();
const apiBase = configuredApiBase.replace(/\/$/, '');
const isApiConfigured = Boolean(apiBase) && !apiBase.includes('example.invalid');

export class LicenseService {
  async getStored(): Promise<LicenseInfo | null> {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    return value ? JSON.parse(value) as LicenseInfo : null;
  }
  async activate(rawKey: string): Promise<LicenseInfo> {
    const key = rawKey.replace(/\s+/g, '').toUpperCase();
    if (!/^BUBO-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) throw new Error('INVALID_LICENSE');
    if (__DEV__ && key === 'BUBO-TEST-0000-0000-0000') {
      const info: LicenseInfo = { customerName: 'Development User', licenseKey: key, status: 'ACTIVE', deviceName: Device.deviceName || 'Android device', validatedAt: new Date().toISOString() };
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(info));
      return info;
    }
    if (!isApiConfigured) throw new Error('LICENSE_API_NOT_CONFIGURED');
    const response = await fetch(`${apiBase}/api/licenses/activate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ license: key, device: { name: Device.deviceName, id: Device.modelId } }) });
    if (!response.ok) throw new Error(response.status === 404 ? 'INVALID_LICENSE' : 'SERVER_ERROR');
    const info = await response.json() as LicenseInfo;
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(info)); return info;
  }
  async validateStored(): Promise<LicenseInfo | null> {
    const current = await this.getStored(); if (!current) return null;
    if (!isApiConfigured) return current;
    try {
      const response = await fetch(`${apiBase}/api/licenses/validate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ license: current.licenseKey }) });
      if (!response.ok) return current;
      const next = await response.json() as LicenseInfo; await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)); return next;
    } catch { return current; }
  }
}
export const licenseService = new LicenseService();
