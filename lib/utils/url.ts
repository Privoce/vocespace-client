
/**
 * 判断并为serverUrl生成前缀，如果是ip+端口则加上http://，域名则使用https://
 */
export const httpServerOrIp = (serverUrl: string) => {
  if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
    return serverUrl;
  }

  if (/^[\d.]+:\d+$/.test(serverUrl)) {
    return `http://${serverUrl}`;
  } else {
    return `https://${serverUrl}`;
  }
};
