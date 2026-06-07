import { Command } from 'commander';
import { JdyClient } from '../client';
import { printAuditLogs, printAuditLogDomains } from '../utils';

export function register(program: Command, getClient: () => JdyClient): void {
  const audit = program.command('audit-log').description('审计日志接口');
  const json = () => program.optsWithGlobals().json;

  audit
    .command('list')
    .description('查询审计日志明细')
    .requiredOption('--domain <domain>', '日志范围 (login, platform, app_builder, kms)')
    .requiredOption('--start <time>', '查询开始时间 (ISO 8601)')
    .requiredOption('--end <time>', '查询结束时间 (ISO 8601)')
    .option('--event-types <list>', '事件类型列表 (逗号分隔)')
    .option('--actor-ids <list>', '操作人ID列表 (逗号分隔)')
    .option('--app-ids <list>', '应用ID列表 (逗号分隔)')
    .option('--entry-ids <list>', '表单ID列表 (逗号分隔)')
    .option('--limit <number>', '返回条数', '200')
    .option('--cursor <string>', '翻页游标')
    .option('--all', '自动翻页获取全部数据', false)
    .option('--page-size <number>', '翻页时每页条数')
    .action(async (options) => {
      const buildParams = () => {
        const p: Record<string, unknown> = {
          domain: options.domain,
          time_range: { start: options.start, end: options.end },
        };
        if (options.eventTypes) p.event_types = options.eventTypes.split(',');
        const filters: Record<string, unknown> = {};
        if (options.actorIds) filters.actor_ids = options.actorIds.split(',');
        if (options.appIds) filters.app_ids = options.appIds.split(',');
        if (options.entryIds) filters.entry_ids = options.entryIds.split(',');
        if (Object.keys(filters).length > 0) p.filters = filters;
        return p;
      };

      if (options.all) {
        const p = buildParams();
        const res = await getClient().listAllAuditLogs({
          domain: p.domain as string,
          time_range: p.time_range as { start: string; end: string },
          event_types: p.event_types as string[] | undefined,
          filters: p.filters as Record<string, unknown> | undefined,
          pageSize: options.pageSize ? Number(options.pageSize) : Number(options.limit),
        });
        if (json()) { console.log(JSON.stringify(res)); return; }
        printAuditLogs(res.items);
        return;
      }

      const params: {
        domain: string;
        time_range: { start: string; end: string };
        event_types?: string[];
        limit?: number;
        cursor?: string;
        filters?: Record<string, unknown>;
      } = {
        domain: options.domain,
        time_range: { start: options.start, end: options.end },
        limit: Number(options.limit),
      };
      if (options.eventTypes) params.event_types = options.eventTypes.split(',');
      const filters: Record<string, unknown> = {};
      if (options.actorIds) filters.actor_ids = options.actorIds.split(',');
      if (options.appIds) filters.app_ids = options.appIds.split(',');
      if (options.entryIds) filters.entry_ids = options.entryIds.split(',');
      if (Object.keys(filters).length > 0) params.filters = filters;
      if (options.cursor) params.cursor = options.cursor;
      const res = await getClient().listAuditLogs(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printAuditLogs(res.items);
      if (res.has_more) {
        console.log(`\n  还有更多数据，使用 --cursor ${res.cursor} 翻页`);
      }
    });

  audit
    .command('domains')
    .description('获取审计日志类型定义')
    .action(async () => {
      const res = await getClient().getAuditLogDomains();
      if (json()) { console.log(JSON.stringify(res)); return; }
      printAuditLogDomains(res.domains);
    });
}
