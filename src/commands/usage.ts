import { Command } from 'commander';
import { JdyClient } from '../client';
import { printUsageOverview, printUsageAppItems, printUsageMemberItems } from '../utils';

export function register(program: Command, getClient: () => JdyClient): void {
  const usage = program.command('usage').description('资源用量接口');
  const json = () => program.optsWithGlobals().json;

  usage
    .command('overview')
    .description('获取平台资源用量统计')
    .option('--date <date>', '日期 (yyyy-MM-dd, 默认前一天)')
    .action(async (options) => {
      const res = await getClient().getUsageOverview(options.date);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printUsageOverview(res.date, res.metrics);
    });

  usage
    .command('app-metrics')
    .description('获取应用资源用量统计')
    .option('--date <date>', '日期 (yyyy-MM-dd)')
    .option('--app-ids <list>', '应用ID列表 (逗号分隔, 最多10个)')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '20')
    .action(async (options) => {
      const params: { date?: string; app_ids?: string[]; skip?: number; limit?: number } = {};
      if (options.date) params.date = options.date;
      if (options.appIds) params.app_ids = options.appIds.split(',');
      params.skip = Number(options.skip);
      params.limit = Number(options.limit);
      const res = await getClient().getUsageAppMetrics(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`统计日期: ${res.date}`);
      printUsageAppItems(res.items);
    });

  usage
    .command('member-metrics')
    .description('获取成员资源用量统计')
    .option('--date <date>', '日期 (yyyy-MM-dd)')
    .option('--member-ids <list>', '成员ID列表 (逗号分隔, 最多10个)')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '20')
    .action(async (options) => {
      const params: { date?: string; member_ids?: string[]; skip?: number; limit?: number } = {};
      if (options.date) params.date = options.date;
      if (options.memberIds) params.member_ids = options.memberIds.split(',');
      params.skip = Number(options.skip);
      params.limit = Number(options.limit);
      const res = await getClient().getUsageMemberMetrics(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`统计日期: ${res.date}`);
      printUsageMemberItems(res.items);
    });
}
