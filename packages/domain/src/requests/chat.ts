

/**
 * 处理文件系统操作
 * - rm: 删除文件
 * - download: 下载文件
 * - ls: 列出所有文件（TilePlayer组件中使用时就是获取文件url）
 * - rm -a: 删除所有文件
 * - upload: 上传文件（目前仅TilePlayer组件使用）
 */
export type HandleFileSystemType = 'rm' | 'download' | 'ls' | 'rm -a' | 'upload';

export interface HandleFileSystemBody {
  spaceName: string;
  ty: HandleFileSystemType;
  fileName?: string;
}

export interface HandleTilePlayerFileBody<TFile = never> {
  spaceName: string;
  room?: string;
  ty: HandleFileSystemType | 'set_meta' | 'create_hyperbeam' | 'create_whiteboard'; // 默认为ls
  file?: TFile;
  iframeUrl?: string;
  identity?: string;
  playerId?: string;
}
