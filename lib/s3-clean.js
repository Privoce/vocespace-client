/**
 * S3 File Cleanup Task Management
 * Responsible for creating, persisting, rebuilding, and deleting scheduled cleanup tasks for S3 files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// S3_clean.json file path, stored in the uploads directory at project root
const CLEAN_FILE_PATH = path.join(__dirname, 'uploads', 'S3_clean.json');

// Cleanup task data structure
// @typedef {Object} S3CleanTask
// @property {string} key - S3 file key (e.g., roomName/timestamp.mp4)
// @property {number} expireAt - Expiration timestamp (milliseconds)
// @property {NodeJS.Timeout} [timerId] - Timer ID (not persisted)

// Load S3 config from vocespace.conf.json
function getS3Config() {
  try {
    const configPath = path.join(process.cwd(), 'vocespace.conf.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return config.s3 || {};
  } catch {
    return {};
  }
}

// Ensure uploads directory and clean file exist
function ensureCleanFile() {
  const dirPath = path.dirname(CLEAN_FILE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(CLEAN_FILE_PATH)) {
    fs.writeFileSync(CLEAN_FILE_PATH, JSON.stringify([]));
  }
}

// Read all cleanup tasks
function readTasks() {
  ensureCleanFile();
  try {
    const data = fs.readFileSync(CLEAN_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save all cleanup tasks (excluding timerId)
function saveTasks(tasks) {
  ensureCleanFile();
  const serializable = tasks.map(({ key, expireAt }) => ({ key, expireAt }));
  fs.writeFileSync(CLEAN_FILE_PATH, JSON.stringify(serializable, null, 2));
}

// Get S3 client
function getS3Client() {
  const s3Config = getS3Config();

  if (!s3Config.accessKey || !s3Config.secretKey || !s3Config.bucket || !s3Config.region) {
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

// Delete file from S3
async function deleteFromS3(key) {
  try {
    const client = getS3Client();
    if (!client) {
      console.error('[S3Clean] S3 client not available');
      return false;
    }

    const s3Config = getS3Config();
    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
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
 * Add a new cleanup task, delete the specified S3 file after 7 days
 * @param {string} key - S3 file key
 * @param {number} [delayMs] - Delay in milliseconds (default: 7 days)
 */
export function addCleanTask(key, delayMs = 7 * 24 * 60 * 60 * 1000) {
  const expireAt = Date.now() + delayMs;

  const tasks = readTasks();

  // Check if task already exists
  if (tasks.some((t) => t.key === key)) {
    console.log(`[S3Clean] Task already exists for key: ${key}`);
    return;
  }

  const task = { key, expireAt };
  tasks.push(task);
  saveTasks(tasks);

  // Set timer
  const timerId = setTimeout(async () => {
    const success = await deleteFromS3(key);
    if (success) {
      // After successful deletion, remove from task list
      const currentTasks = readTasks();
      const filtered = currentTasks.filter((t) => t.key !== key);
      saveTasks(filtered);
      console.log(`[S3Clean] Task completed and removed: ${key}`);
    } else {
      // Deletion failed, keep task for retry
      console.error(`[S3Clean] Failed to delete ${key}, task retained`);
    }
  }, delayMs);

  task.timerId = timerId;
  console.log(`[S3Clean] Added cleanup task for ${key}, will delete at ${new Date(expireAt).toISOString()}`);
}

/**
 * Remove a cleanup task (called when file is manually deleted)
 * @param {string} key - S3 file key
 */
export function removeCleanTask(key) {
  const tasks = readTasks();
  const task = tasks.find((t) => t.key === key);

  if (task) {
    // Clear timer
    if (task.timerId) {
      clearTimeout(task.timerId);
    }

    // Remove from list
    const filtered = tasks.filter((t) => t.key !== key);
    saveTasks(filtered);
    console.log(`[S3Clean] Manually removed cleanup task: ${key}`);
  }
}

/**
 * Rebuild all cleanup tasks (called on server startup)
 */
export function rebuildCleanTasks() {
  const tasks = readTasks();

  if (tasks.length === 0) {
    console.log('[S3Clean] No cleanup tasks to rebuild');
    return;
  }

  console.log(`[S3Clean] Rebuilding ${tasks.length} cleanup tasks...`);

  tasks.forEach((task) => {
    const remaining = task.expireAt - Date.now();

    if (remaining <= 0) {
      // Already expired, delete immediately
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
