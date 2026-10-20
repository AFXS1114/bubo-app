import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export type LicenseState = 'NOT_ACTIVATED' | 'ACTIVATING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DEVICE_REPLACEMENT_REQUIRED' | 'NETWORK_REQUIRED' | 'SERVER_ERROR' | 'INVALID_LICENSE';
export type LicenseInfo = { customerName: string; licenseKey: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'; expiresAt?: string; deviceName: string; validatedAt: string; graceUntil?: string; credential?: string };
type ApiLicenseResponse = LicenseInfo & { credential?: string; activationCredential?: string };
const STORAGE_KEY = 'bubo.activation.v2';
const configuredApiBase = String(Constants.expoConfig?.extra?.licenseApiBaseUrl || '').trim();
const apiBase = configuredApiBase.replace(/\/$/, '');

function normalizeKey(rawKey: string): string { return rawKey.replace(/\s+/g, '').toUpperCase(); }
function apiError(status: number): Error {
  if (status === 400 || status === 404) return new Error('INVALID_LICENSE');
  if (status === 401 || status === 403) return new Error('DEVICE_REPLACEMENT_REQUIRED');
  if (status === 409) return new Error('DEVICE_LIMIT_REACHED');
  return new Error('SERVER_ERROR');
}
function mapResponse(raw: ApiLicenseResponse, key: string): LicenseInfo {
  return { ...raw, licenseKey: raw.licenseKey || key, credential: raw.credential || raw.activationCredential };
}

export class LicenseService {
  async getStored(): Promise<LicenseInfo | null> {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    return value ? JSON.parse(value) as LicenseInfo : null;
  }

  async activate(rawKey: string): Promise<LicenseInfo> {
    const key = normalizeKey(rawKey);
    if (!/^BUBO-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) throw new Error('INVALID_LICENSE');
    if (!apiBase || apiBase.includes('example.invalid')) throw new Error('LICENSE_API_NOT_CONFIGURED');
    try {
      const response = await fetch(`${apiBase}/api/licenses/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ license: key, device: { name: Device.deviceName || 'Android device', id: Device.modelId || Device.deviceName || 'unknown-device', appVersion: Constants.expoConfig?.version, platformVersion: Device.osVersion } }),
      });
      if (!response.ok) throw apiError(response.status);
      const info = mapResponse(await response.json() as ApiLicenseResponse, key);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(info));
      return info;
    } catch (error) {
      if (error instanceof Error && error.message !== 'TypeError') throw error;
      throw new Error('NETWORK_REQUIRED');
    }
  }

  async validateStored(): Promise<LicenseInfo | null> {
    const current = await this.getStored();
    if (!current) return null;
    if (!apiBase || apiBase.includes('example.invalid')) return current;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (current.credential) headers.Authorization = `Bearer ${current.credential}`;
      const response = await fetch(`${apiBase}/api/licenses/validate`, { method: 'POST', headers, body: JSON.stringify({ license: current.licenseKey, device: { id: Device.modelId || Device.deviceName || 'unknown-device' } }) });
      if (!response.ok) return current;
      const updated = mapResponse(await response.json() as ApiLicenseResponse, current.licenseKey);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ ...current, ...updated }));
      return { ...current, ...updated };
    } catch { return current; }
  }
}
export const licenseService = new LicenseService();
