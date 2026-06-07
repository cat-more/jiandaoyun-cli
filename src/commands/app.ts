import { Command } from 'commander';
import { JdyClient } from '../client';
import { printApps, printForms, printWidgets } from '../utils';

export function register(program: Command, getClient: () => JdyClient): void {
  const app = program.command('app').description('应用接口');
  const json = () => program.optsWithGlobals().json;

  app
    .command('list')
    .description('查询所有应用')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (options) => {
      const res = await getClient().listApps(Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printApps(res.apps);
    });

  app
    .command('form-list')
    .argument('<appId>', '应用ID')
    .description('查询应用下的表单')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (appId, options) => {
      const res = await getClient().listForms(appId, Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printForms(res.forms);
    });

  app
    .command('form-get')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('查询表单详情')
    .action(async (appId, entryId) => {
      const res = await getClient().getForm(appId, entryId);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`  名称: ${res.form.name}`);
      console.log(`  ID: ${res.form.entry_id}`);
      console.log(`  所属应用: ${res.form.app_id}`);
      if (res.form.description) console.log(`  描述: ${res.form.description}`);
      if (res.form.item_order !== undefined) console.log(`  排序: ${res.form.item_order}`);
    });

  app
    .command('form-widgets')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('查询表单字段列表')
    .action(async (appId, entryId) => {
      const res = await getClient().listWidgets(appId, entryId);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printWidgets(res.widgets);
    });
}
