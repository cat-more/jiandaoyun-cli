import fs from 'fs';
import path from 'path';
import os from 'os';
import { createInterface } from 'readline';

const CONFIG_DIR = path.join(os.homedir(), '.jiandaoyun-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } catch {
    /* 目录已存在或创建失败，后续写入会报错 */
  }
}

function loadConfig(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error(`读取配置文件失败: ${(e as Error).message}`);
  }
  return {};
}

function saveConfig(config: Record<string, string>): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
    try { fs.chmodSync(CONFIG_FILE, 0o600); } catch { /* 平台可能不支持 chmod，不影响写入 */ }
  } catch (e) {
    console.error(`保存配置文件失败: ${(e as Error).message}`);
  }
}

export function getApiKey(cliApiKey?: string): string | null {
  if (cliApiKey) return cliApiKey;
  if (process.env.JDY_API_KEY) return process.env.JDY_API_KEY;
  const config = loadConfig();
  return config.apiKey || null;
}

export function setConfig(key: string, value: string): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

export function getConfig(key?: string): Record<string, string> | string | null {
  const config = loadConfig();
  if (key) return config[key] || null;
  return config;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function parseFileSize(val: string): number {
  const match = val.match(/^(\d+)\s*(KB|MB|GB|K|M|G|B)?$/i);
  if (!match) return 100 * 1024 * 1024;
  const num = parseInt(match[1], 10);
  const unit = (match[2] || '').toUpperCase();
  if (unit === 'GB' || unit === 'G') return num * 1024 * 1024 * 1024;
  if (unit === 'MB' || unit === 'M') return num * 1024 * 1024;
  if (unit === 'KB' || unit === 'K') return num * 1024;
  return num;
}

export function getMaxUploadSize(): number {
  const config = loadConfig();
  const raw = config.maxUploadSize;
  if (!raw) return 100 * 1024 * 1024;
  return parseFileSize(raw);
}

