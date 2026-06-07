#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { JdyClient, ApiError } from './client';
import { getApiKey, getMaxUploadSize } from './config';

declare module 'commander' {
  interface Command {
    __client?: JdyClient;
  }
}
import { register as registerApp } from './commands/app';
import { register as registerData } from './commands/data';
import { register as registerWorkflow } from './commands/workflow';
import { register as registerAddressbook } from './commands/addressbook';
import { register as registerConfig } from './commands/config';
import { register as registerUsage } from './commands/usage';
import { register as registerAuditLog } from './commands/audit-log';
import { register as registerFile } from './commands/file';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('jdy')
  .description('简道云 CLI 工具')
  .version(version)
  .option('--api-key <key>', 'API Key')
  .option('--json', 'JSON 格式输出')
  .hook('preAction', (thisCmd, actionCmd) => {
    const topCmd = actionCmd.parent === thisCmd ? actionCmd : actionCmd.parent;
    if (topCmd?.name() === 'config' || actionCmd.name() === 'help') return;

    const opts = thisCmd.optsWithGlobals();
    const apiKey = getApiKey(opts.apiKey);
    if (!apiKey) {
      console.error('错误: 未设置 API Key');
      console.error('用法: jdy config set apiKey <key>');
      console.error('或: 设置 JDY_API_KEY 环境变量');
      console.error('或: jdy --api-key <key> <command>');
      process.exit(1);
    }
    thisCmd.__client = new JdyClient(apiKey, getMaxUploadSize());
  });

function getClient(cmd: Command): JdyClient {
  let c: Command | null = cmd;
  while (c) {
    if (c.__client) return c.__client;
    c = c.parent;
  }
  throw new Error('Client not initialized');
}

registerApp(program, () => getClient(program));
registerData(program, () => getClient(program));
registerWorkflow(program, () => getClient(program));
registerAddressbook(program, () => getClient(program));
registerConfig(program);
registerUsage(program, () => getClient(program));
registerAuditLog(program, () => getClient(program));
registerFile(program, () => getClient(program));

program.parseAsync(process.argv).catch((err) => {
  if (err instanceof ApiError) {
    console.error('错误:', err.message);
  } else {
    console.error('未预期错误:', err);
  }
  process.exit(1);
});
