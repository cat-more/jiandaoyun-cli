import { Command } from 'commander';
import { JdyClient } from '../client';
import * as crypto from 'crypto';

function generateTransactionId(): string {
  return crypto.randomUUID();
}

export function register(program: Command, getClient: () => JdyClient): void {
  const file = program.command('file').description('文件接口');
  const json = () => program.optsWithGlobals().json;

  file
    .command('get-upload-token')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('获取文件上传凭证和上传地址')
    .option('--transaction-id <id>', '事务ID (自动生成)')
    .action(async (appId, entryId, options) => {
      const transactionId = options.transactionId || generateTransactionId();
      const res = await getClient().getUploadToken({
        app_id: appId,
        entry_id: entryId,
        transaction_id: transactionId,
      });
      if (json()) { console.log(JSON.stringify({ transaction_id: transactionId, ...res })); return; }
      console.log(`事务ID: ${transactionId}`);
      console.log(`获取到 ${res.token_and_url_list.length} 个上传凭证:\n`);
      res.token_and_url_list.forEach((item, i) => {
        console.log(`  [${i + 1}]`);
        console.log(`      URL: ${item.url}`);
        console.log(`      Token: ${item.token.slice(0, 20)}...`);
      });
    });

  file
    .command('upload')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .argument('<filePath>', '本地文件路径')
    .description('上传文件（自动获取凭证+上传）')
    .option('--transaction-id <id>', '事务ID (自动生成)')
    .action(async (appId, entryId, filePath, options) => {
      const transactionId = options.transactionId || generateTransactionId();
      const tokenRes = await getClient().getUploadToken({
        app_id: appId,
        entry_id: entryId,
        transaction_id: transactionId,
      });
      const { url, token } = tokenRes.token_and_url_list[0];
      const res = await getClient().uploadFile(url, token, filePath);
      if (json()) { console.log(JSON.stringify({ transaction_id: transactionId, ...res })); return; }
      console.log(`事务ID: ${transactionId}`);
      console.log(`文件Key: ${res.key}`);
      console.log(`上传成功，key 可用于 data create/update 的附件/图片字段`);
    });
}
