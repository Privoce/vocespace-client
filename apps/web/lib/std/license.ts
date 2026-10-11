export * from '@vocespace/domain/license';
import {
  DEFAULT_LICENSE,
  DEFAULT_TMP_LICENSE,
  type License,
  type LicenseClaims,
} from '@vocespace/domain/license';
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

