import { connect_endpoint } from '../std';

const LICENSE_API_URL = connect_endpoint('/api/license');

/**
 * 请求创建Stripe支付session（获取支付链接）
 * 请求本地API，由后端根据WEBHOOT环境变量决定本地处理还是转发到vocespace.com
 * @param ip 服务器IP地址/域名
 */
export const getLicenseByIP = async (ip: string) => {
  const url = new URL(connect_endpoint('/api/webhook'), window.location.origin);
  url.searchParams.set('session_ip', ip);
  return await fetch(url.toString(), {
    method: 'GET',
  });
};

/**
 * 检查服务器的license是否有效
 * 请求本地API，由后端根据WEBHOOK环境变量决定本地处理还是转发到vocespace.com
 * @param ip 服务器IP地址/域名
 */
export const checkLicenseByIP = async (ip: string) => {
  const url = new URL(`${LICENSE_API_URL}/domains/${encodeURIComponent(ip)}`, window.location.origin);
  return await fetch(url.toString(), {
    method: 'GET',
  });
};

// 以下为本地license管理API ------------------------------------------------

/**
 * 获取所有证书（管理员用）
 * @param hostToken 管理员令牌
 */
export const getAllLicenses = async (hostToken: string) => {
  const url = new URL(LICENSE_API_URL, window.location.origin);
  url.searchParams.append('hostToken', hostToken);
  return await fetch(url.toString(), {
    method: 'GET',
  });
};

/**
 * 创建证书
 * @param params 证书参数
 * @param hostToken 管理员令牌
 */
export const createLicense = async (
  params: { email?: string; domains?: string; created_at?: number; ilimit?: string; sendEmail?: boolean; value?: string },
  hostToken: string,
) => {
  const url = new URL(LICENSE_API_URL, window.location.origin);
  url.searchParams.append('hostToken', hostToken);
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      domains: params.domains,
      created_at: params.created_at || Math.floor(Date.now() / 1000),
      ilimit: params.ilimit,
      sendEmail: params.sendEmail,
      value: params.value,
    }),
  });
};

/**
 * 更新证书
 * @param params 更新参数
 * @param hostToken 管理员令牌
 */
export const updateLicense = async (
  params: { email: string; value: string; newDomains?: string; newEmail?: string; sendEmail?: boolean },
  hostToken: string,
) => {
  const url = new URL(LICENSE_API_URL, window.location.origin);
  url.searchParams.append('hostToken', hostToken);
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
};

/**
 * 删除证书
 * @param id 证书ID（为空时删除所有）
 * @param hostToken 管理员令牌
 */
export const deleteAllLicenses = async (hostToken: string, id?: string) => {
  const url = new URL(LICENSE_API_URL, window.location.origin);
  url.searchParams.append('hostToken', hostToken);
  if (id) url.searchParams.append('id', id);
  return await fetch(url.toString(), {
    method: 'DELETE',
  });
};

/**
 * 验证证书值是否有效
 * @param value 证书JWT值
 */
export const validateLicenseValue = async (value: string) => {
  const url = new URL(`${LICENSE_API_URL}/${encodeURIComponent(value)}`, window.location.origin);
  return await fetch(url.toString(), {
    method: 'GET',
  });
};
