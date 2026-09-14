
/**
 * 通过url下载文件
 * @param url
 */
export const downloadFile = (url: string, fileName: string) => {
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
};
