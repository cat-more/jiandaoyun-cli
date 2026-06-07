import { Command } from 'commander';
import { JdyClient } from '../client';
import { printDataList, printDataDetail, buildWidgetMap, WidgetInfo, ensureConfirm } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

async function getWidgetMap(client: JdyClient, appId: string, entryId: string): Promise<Record<string, WidgetInfo>> {
  const res = await client.listWidgets(appId, entryId);
  return buildWidgetMap(res.widgets);
}

function parseData(dataStr: string): Record<string, unknown> | Record<string, unknown>[] {
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.error('JSON 格式错误:', (e as Error).message);
    process.exit(1);
  }
}

function checkDataFormat(data: unknown, path = ''): void {
  if (typeof data !== 'object' || data === null) return;
  if (Array.isArray(data)) {
    data.forEach((item, i) => checkDataFormat(item, `${path}[${i}]`));
    return;
  }
  for (const [key, val] of Object.entries(data)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      checkDataFormat(val, fullPath);
    }
    if (key.startsWith('_widget_') && (typeof val !== 'object' || val === null || !('value' in (val as Record<string, unknown>)))) {
      console.warn(`⚠️ 字段 "${fullPath}" 的值缺少 {"value": ...} 包装，简道云可能忽略该字段`);
    }
  }
}

function safeResolvePath(filePath: string, baseDir = process.cwd()): string {
  const resolved = path.resolve(baseDir, filePath);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    console.error(`不允许访问基目录之外的路径: ${filePath}`);
    process.exit(1);
  }
  return resolved;
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(safeResolvePath(filePath), 'utf-8');
  } catch (e) {
    console.error(`读取文件失败: ${(e as Error).message}`);
    process.exit(1);
  }
}

export function register(program: Command, getClient: () => JdyClient): void {
  const data = program.command('data').description('数据接口');
  const json = () => program.optsWithGlobals().json;

  data
    .command('list')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('查询多条数据')
    .option('--limit <number>', '每页条数', '100')
    .option('--filter <json>', '过滤条件 (JSON字符串)')
    .option('--fields <list>', '字段列表 (逗号分隔)')
    .option('--all', '自动翻页获取全部数据', false)
    .option('--page-size <number>', '翻页时每页条数')
    .action(async (appId, entryId, options) => {
      if (options.all) {
        const res = await getClient().listAllData(appId, entryId, {
          pageSize: options.pageSize ? Number(options.pageSize) : Number(options.limit),
          filter: options.filter ? parseData(options.filter) as Record<string, unknown> : undefined,
          fields: options.fields ? options.fields.split(',') : undefined,
        });
        if (json()) { console.log(JSON.stringify(res)); return; }
        const widgetMap = await getWidgetMap(getClient(), appId, entryId);
        printDataList(res.data, widgetMap, res.total);
        return;
      }
      const params: Record<string, unknown> = { limit: Number(options.limit) };
      if (options.filter) params.filter = parseData(options.filter);
      if (options.fields) params.fields = options.fields.split(',');
      const res = await getClient().listData(appId, entryId, params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      const widgetMap = await getWidgetMap(getClient(), appId, entryId);
      printDataList(res.data, widgetMap, res.total);
    });

  data
    .command('get')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .argument('<dataId>', '数据ID')
    .description('查询单条数据')
    .action(async (appId, entryId, dataId) => {
      const res = await getClient().getData(appId, entryId, dataId);
      if (json()) { console.log(JSON.stringify(res)); return; }
      const widgetMap = await getWidgetMap(getClient(), appId, entryId);
      printDataDetail(res.data, widgetMap);
    });

  // === WRITE COMMANDS ===

  data
    .command('create')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('新建单条数据')
    .option('--data <json>', '数据内容 (JSON, 如 \'{"_widget_xxx":{"value":"..."}}\')')
    .option('--file <path>', '从文件读取数据内容')
    .option('--creator <username>', '数据提交人')
    .option('--start-workflow', '发起流程', false)
    .option('--start-trigger', '触发智能助手', false)
    .option('--dry-run', '预览不提交', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, options) => {
      const raw = options.data ? parseData(options.data) : JSON.parse(readFile(options.file));
      checkDataFormat(raw);
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, data: raw, dryRun: true })); return; }
        console.log('预览数据:', JSON.stringify(raw, null, 2)); return;
      }
      await ensureConfirm(`确认新建数据?`, options.yes);
      const res = await getClient().createData({
        app_id: appId,
        entry_id: entryId,
        data: raw as Record<string, unknown>,
        data_creator: options.creator,
        is_start_workflow: options.startWorkflow,
        is_start_trigger: options.startTrigger,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`新建成功, 数据ID: ${res.data._id}`);
    });

  data
    .command('update')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .argument('<dataId>', '数据ID')
    .description('修改单条数据')
    .option('--data <json>', '数据内容 (JSON)')
    .option('--file <path>', '从文件读取数据内容')
    .option('--start-trigger', '触发智能助手', false)
    .option('--dry-run', '预览不提交', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, dataId, options) => {
      const raw = options.data ? parseData(options.data) : JSON.parse(readFile(options.file));
      checkDataFormat(raw);
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, dataId, data: raw, dryRun: true })); return; }
        console.log('预览数据:', JSON.stringify(raw, null, 2)); return;
      }
      await ensureConfirm(`确认修改数据 ${dataId}?`, options.yes);
      const res = await getClient().updateData({
        app_id: appId,
        entry_id: entryId,
        data_id: dataId,
        data: raw as Record<string, unknown>,
        is_start_trigger: options.startTrigger,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('修改成功');
    });

  data
    .command('delete')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .argument('<dataId>', '数据ID')
    .description('删除单条数据')
    .option('--start-trigger', '触发智能助手', false)
    .option('--dry-run', '预览不删除', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, dataId, options) => {
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, dataId, dryRun: true })); return; }
        console.log(`预览: 删除数据 ${dataId}`); return;
      }
      await ensureConfirm(`确认删除数据 ${dataId}?`, options.yes);
      const res = await getClient().deleteData({ app_id: appId, entry_id: entryId, data_id: dataId, is_start_trigger: options.startTrigger });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('删除成功');
    });

  data
    .command('batch-create')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('新建多条数据')
    .option('--data <json>', '数据内容数组 (JSON)')
    .option('--file <path>', '从文件读取数据数组 (JSON)')
    .option('--creator <username>', '数据提交人')
    .option('--start-workflow', '发起流程', false)
    .option('--dry-run', '预览不提交', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, options) => {
      const raw = options.data ? parseData(options.data) : JSON.parse(readFile(options.file));
      checkDataFormat(raw);
      const list = Array.isArray(raw) ? raw : [raw];
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, count: list.length, dryRun: true })); return; }
        console.log(`预览: 将新建 ${list.length} 条数据`); return;
      }
      await ensureConfirm(`确认新建 ${list.length} 条数据?`, options.yes);
      const res = await getClient().batchCreateData({
        app_id: appId,
        entry_id: entryId,
        data_list: list as Record<string, unknown>[],
        data_creator: options.creator,
        is_start_workflow: options.startWorkflow,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`批量新建完成: ${res.success_count} 条成功`);
    });

  data
    .command('batch-update')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('修改多条数据')
    .requiredOption('--ids <list>', '数据ID列表 (逗号分隔)')
    .option('--data <json>', '数据内容 (JSON, 统一修改为相同值)')
    .option('--file <path>', '从文件读取数据内容')
    .option('--dry-run', '预览不提交', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, options) => {
      const ids = options.ids.split(',');
      const raw = options.data ? parseData(options.data) : JSON.parse(readFile(options.file));
      checkDataFormat(raw);
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, ids, data: raw, dryRun: true })); return; }
        console.log(`预览: 将修改 ${ids.length} 条数据`); return;
      }
      await ensureConfirm(`确认修改 ${ids.length} 条数据?`, options.yes);
      const res = await getClient().batchUpdateData({
        app_id: appId,
        entry_id: entryId,
        data_ids: ids,
        data: raw as Record<string, unknown>,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`批量修改完成: ${res.success_count} 条成功`);
    });

  data
    .command('batch-delete')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .description('删除多条数据')
    .requiredOption('--ids <list>', '数据ID列表 (逗号分隔)')
    .option('--dry-run', '预览不删除', false)
    .option('--yes', '跳过确认', false)
    .action(async (appId, entryId, options) => {
      const ids = options.ids.split(',');
      if (options.dryRun) {
        if (json()) { console.log(JSON.stringify({ appId, entryId, ids, dryRun: true })); return; }
        console.log(`预览: 将删除 ${ids.length} 条数据`); return;
      }
      await ensureConfirm(`确认删除 ${ids.length} 条数据?`, options.yes);
      const res = await getClient().batchDeleteData({ app_id: appId, entry_id: entryId, data_ids: ids });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`批量删除完成: ${res.success_count} 条成功`);
    });
}
