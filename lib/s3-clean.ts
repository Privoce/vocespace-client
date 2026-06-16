/**
 * S3 文件清理任务管理
 * 负责创建、持久化、重建和删除 S3 文件的定时清理任务
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getConfig } from '@/app/api/conf/conf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// S3_clean.json 文件路径，存放在根目录的 uploads 目录
const CLEAN_FILE_PATH = path.join(__dirname, 'uploads', 'S3_clean.json');

// 清理任务数据结构
export interface S3CleanTask {
  key: string;           // S3 文件 key (如: roomName/timestamp.mp4)
  expireAt: number;      // 过期时间戳 (毫秒)
  timerId?: NodeJS.Timeout; // 定时器 ID (不持久化)
}

// 确保 uploads 目录和清理文件存在
function ensureCleanFile() {
  const dirPath = path.dirname(CLEAN_FILE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(CLEAN_FILE_PATH)) {
    fs.writeFileSync(CLEAN_FILE_PATH, JSON.stringify([]));
  }
}

// 读取所有清理任务
function readTasks(): S3CleanTask[] {
  ensureCleanFile();
  try {
    const data = fs.readFileSync(CLEAN_FILE_PATH, 'utf-8');
    return JSON.parse(data) as S3CleanTask[];
  } catch {
    return [];
  }
}

// 保存所有清理任务 (不包含 timerId)
function saveTasks(tasks: S3CleanTask[]) {
  ensureCleanFile();
  const serializable = tasks.map(({ key, expireAt }) => ({ key, expireAt }));
  fs.writeFileSync(CLEAN_FILE_PATH, JSON.stringify(serializable, null, 2));
}

// 获取 S3 客户端
function getS3Client(): S3Client | null {
  const config = getConfig();
  const s3Config = config.s3;

  if (!s3Config?.accessKey || !s3Config?.secretKey || !s3Config?.bucket || !s3Config?.region) {
    return null;
  }

  return new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
    },
  });
}

// 从 S3 删除文件
async function deleteFromS3(key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    if (!client) {
      console.error('[S3Clean] S3 client not available');
      return false;
    }

    const config = getConfig();
    const command = new DeleteObjectCommand({
      Bucket: config.s3!.bucket,
      Key: key,
    });

    await client.send(command);
    console.log(`[S3Clean] Deleted S3 object: ${key}`);
    return true;
  } catch (error) {
    console.error(`[S3Clean] Failed to delete S3 object ${key}:`, error);
    return false;
  }
}

/**
 * 添加一个新的清理任务，7 天后删除指定的 S3 文件
 */
export function addCleanTask(key: string, delayMs: number = 7 * 24 * 60 * 60 * 1000): void {
  const expireAt = Date.now() + delayMs;

  const tasks = readTasks();

  // 检查是否已存在相同的任务
  if (tasks.some((t) => t.key === key)) {
    console.log(`[S3Clean] Task already exists for key: ${key}`);
    return;
  }

  const task: S3CleanTask = { key, expireAt };
  tasks.push(task);
  saveTasks(tasks);

  // 设置定时器
  const timerId = setTimeout(async () => {
    const success = await deleteFromS3(key);
    if (success) {
      // 删除成功后，从任务列表中移除
      const currentTasks = readTasks();
      const filtered = currentTasks.filter((t) => t.key !== key);
      saveTasks(filtered);
      console.log(`[S3Clean] Task completed and removed: ${key}`);
    } else {
      // 删除失败，保留任务以便下次重试
      console.error(`[S3Clean] Failed to delete ${key}, task retained`);
    }
  }, delayMs);

  task.timerId = timerId;
  console.log(`[S3Clean] Added cleanup task for ${key}, will delete at ${new Date(expireAt).toISOString()}`);
}

/**
 * 删除一个清理任务（文件被手动删除时调用）
 */
export function removeCleanTask(key: string): void {
  const tasks = readTasks();
  const task = tasks.find((t) => t.key === key);

  if (task) {
    // 清除定时器
    if (task.timerId) {
      clearTimeout(task.timerId);
    }

    // 从列表中移除
    const filtered = tasks.filter((t) => t.key !== key);
    saveTasks(filtered);
    console.log(`[S3Clean] Manually removed cleanup task: ${key}`);
  }
}

/**
 * 重建所有清理任务（服务器启动时调用）
 */
export function rebuildCleanTasks(): void {
  const tasks = readTasks();

  if (tasks.length === 0) {
    console.log('[S3Clean] No cleanup tasks to rebuild');
    return;
  }

  console.log(`[S3Clean] Rebuilding ${tasks.length} cleanup tasks...`);

  tasks.forEach((task) => {
    const remaining = task.expireAt - Date.now();

    if (remaining <= 0) {
      // 已经过期，立即删除
      deleteFromS3(task.key).then((success) => {
        if (success) {
          const currentTasks = readTasks();
          const filtered = currentTasks.filter((t) => t.key !== task.key);
          saveTasks(filtered);
        }
      });
      console.log(`[S3Clean] Task already expired, deleting immediately: ${task.key}`);
      return;
    }

    const timerId = setTimeout(async () => {
      const success = await deleteFromS3(task.key);
      if (success) {
        const currentTasks = readTasks();
        const filtered = currentTasks.filter((t) => t.key !== task.key);
        saveTasks(filtered);
        console.log(`[S3Clean] Task completed and removed: ${task.key}`);
      }
    }, remaining);

    task.timerId = timerId;
    console.log(`[S3Clean] Restored task for ${task.key}, will delete at ${new Date(task.expireAt).toISOString()}`);
  });
}
