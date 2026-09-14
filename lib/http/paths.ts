
/**
 * src路径，根据部署的basePath进行调整
 * 使用在img,video等标签的src属性上
 * @param url
 * @returns
 */
export function src(url: string): string {
  const prefix =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BASE_PATH : undefined) ?? '';
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}


/**
 * 连接端点路径，根据部署的basePath进行调整
 * @param url
 * @returns
 */
export function connect_endpoint(url: string): string {
  const prefix =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BASE_PATH : undefined) ?? '';
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}
