import { PresetStatusColorType } from 'antd/es/_util/colors';

export type LicenseLimit = 'free' | 'pro' | 'enterprise';

export interface LicenseClaims {
  /**
   * License ID
   */
  id: string;
  /**
   * user email (buyer email)
   */
  email: string;
  /**
   * server domain
   */
  domains: string;
  /**
   * license creation timestamp
   */
  created_at: number;
  /**
   * license expiration timestamp
   */
  expires_at: number;
  /**
   * license limit
   */
  limit: LicenseLimit;
}

/**
 * License information
 */
export interface License extends LicenseClaims {
  /**
   * is a temporary license or not
   */
  isTmp: boolean;
  /**
   * license token value
   */
  value: string;
}

export const getLicensePersonLimit = (licenseLimit: LicenseLimit, isTmp?: boolean): number => {
  switch (licenseLimit) {
    case 'free':
      return 5;
    case 'pro':
      return isTmp ? 20 : 9999;
    case 'enterprise':
      return isTmp ? 20 : 9999;
    default:
      return 5;
  }
};

export enum LicenseStatus {
  /**
   * license is expired
   */
  Expired,
  /**
   * license is valid
   */
  Valid,
  /**
   * tmp valid
   */
  Tmp,
}

export const licenseStatus = (license: License): LicenseStatus => {
  const now = Date.now();
  if (license.isTmp) {
    return LicenseStatus.Tmp;
  } else {
    if (now > license.expires_at * 1000) {
      return LicenseStatus.Expired;
    }
    return LicenseStatus.Valid;
  }
};

export const licenseStatusStr = (status: LicenseStatus): string => {
  switch (status) {
    case LicenseStatus.Expired:
      return 'Expired';
    case LicenseStatus.Valid:
      return 'Valid';
    case LicenseStatus.Tmp:
      return 'Temporary';
    default:
      return 'Expired';
  }
};

export const licenseStatusColor = (status: LicenseStatus): PresetStatusColorType => {
  switch (status) {
    case LicenseStatus.Expired:
      return 'error';
    case LicenseStatus.Valid:
      return 'success';
    case LicenseStatus.Tmp:
      return 'warning';
    default:
      return 'error';
  }
};

/**
 * 在Docker环境下，默认使用临时证书，属于发布版本的免费试用证书
 */
export const DEFAULT_TMP_LICENSE: License = {
  email: 'han@privoce.com',
  expires_at: 4891334400,
  created_at: 1735660800,
  domains: '*',
  limit: 'free',
  id: '64e2260e-1340-4164-9cfd-30e028ea84ed',
  isTmp: true,
  value:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImhhbkBwcml2b2NlLmNvbSIsImV4cGlyZXNfYXQiOjQ4OTEzMzQ0MDAsImNyZWF0ZWRfYXQiOjE3MzU2NjA4MDAsImRvbWFpbnMiOiIqIiwibGltaXQiOiJmcmVlIiwiaWQiOiI2NGUyMjYwZS0xMzQwLTQxNjQtOWNmZC0zMGUwMjhlYTg0ZWQifQ.T0vIHUCxv9j75lb92RDDaegpPO9W9hxWEXqZVidwL0E',
};

/**
 * 默认的免费证书，当前免费给发布版本使用
 */
export const DEFAULT_LICENSE: License = {
  id: '6df82132-2284-4f61-bbfa-fdfe8bc31a67',
  email: 'han@privoce.com',
  domains: '*',
  created_at: 1779278400,
  expires_at: 1747742400,
  limit: 'pro',
  isTmp: true,
  value:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImhhbkBwcml2b2NlLmNvbSIsImV4cGlyZXNfYXQiOjE3NzkyNzg0MDAsImNyZWF0ZWRfYXQiOjE3NDc3NDI0MDAsImRvbWFpbnMiOiIqIiwibGltaXQiOiJwcm8iLCJpZCI6IjZkZjgyMTMyLTIyODQtNGY2MS1iYmZhLWZkZmU4YmMzMWE2NyJ9.PiagYRDWSpzhIdbnY-pp8QeOf5Ij7neV8RMEafDgVT4',
};

export const base64UrlDecode = (base64Url: string): string => {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  if (typeof window !== 'undefined' && window.atob) {
    return decodeURIComponent(escape(window.atob(base64)));
  } else {
    throw new Error('Base64 decoding requires browser environment');
  }
};

const validateClaims = (claims: any): claims is LicenseClaims => {
  return (
    typeof claims === 'object' &&
    typeof claims.email === 'string' &&
    typeof claims.expires_at === 'number' &&
    typeof claims.created_at === 'number' &&
    typeof claims.domains === 'string' &&
    typeof claims.limit === 'string' &&
    typeof claims.id === 'string'
  );
};

/**
 * Analyze the license token and return the License object
 * 解析证书信息
 */
export const analyzeLicense = (
  licenseToken: string,
  onError?: (error: Error | any) => void,
): License => {
  try {
    const parts = licenseToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid license format');
    }

    // 解码 payload (第二部分)
    const payload = parts[1];

    // Base64 URL 解码
    const decodedPayload = base64UrlDecode(payload);
    const claims: LicenseClaims = JSON.parse(decodedPayload);

    // 验证必要字段
    if (!validateClaims(claims)) {
      throw new Error('Invalid license claims');
    }

    let isTmp = false;
    if (licenseToken === DEFAULT_LICENSE.value || licenseToken === DEFAULT_TMP_LICENSE.value) {
      isTmp = true;
    }

    return {
      ...claims,
      value: licenseToken,
      isTmp,
    };
  } catch (error) {
    console.error('Failed to parse license:', error);
    onError?.(error);
    return DEFAULT_TMP_LICENSE;
  }
};

/**
 * validate license domain is in domains list
 * @param domains domains list which from license
 * @param selfDomain from vocespace config serverUrl
 */
export const validLicenseDomain = (domains: string, selfDomain: string): boolean => {
  if (selfDomain === 'localhost' || selfDomain === '127.0.0.1') {
    return true;
  }
  if (domains === '*') {
    return true;
  }
  const domainList = domains.split(',');
  return domainList.includes(selfDomain);
};
