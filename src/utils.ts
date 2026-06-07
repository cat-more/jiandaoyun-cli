import {
  WorkflowInstanceResponse, WorkflowLog, ApprovalComment,
  AppInfo, FormInfo, DeptInfo, TaskItem,
  CcItem, UsageMetrics, UsageAppItem, UsageMemberItem,
  AuditLogItem, AuditLogDomain, RoleInfo, RoleGroupInfo, GuestDeptInfo, GuestUserInfo,
} from './types';
import * as readline from 'readline';

export function formatAction(action: string): string {
  const map: Record<string, string> = {
    forward: '提交',
    back: '回退',
    transfer: '转交',
    close: '结束',
    revoke: '撤回',
    activate: '激活',
    reject: '否决',
    sign_before: '前加签',
    sign_after: '后加签',
    sign_parallel: '并加签',
    auto_approve: '去重审批',
    auto_forward: '超时自动提交',
    auto_back: '超时自动回退',
    batch_forward: '批量提交',
    batch_transfer: '批量调整负责人',
    invoke_plugin: '插件执行',
  };
  return map[action] ?? action;
}

export function formatTaskStatus(status: number): string {
  return ['进行中', '已完成/否决', '手动结束', '', '已激活', '已暂停'][status] ?? String(status);
}

export function formatInstanceStatus(status: number): string {
  return ['进行中', '流转完成/否决', '手动结束'][status] ?? String(status);
}

export function formatUser(entity: { name?: string; username?: string } | undefined | null): string {
  if (!entity) return '-';
  return entity.name || entity.username || '-';
}

export function printApps(apps: AppInfo[]): void {
  if (apps.length === 0) { console.log('无应用'); return; }
  console.log(`共 ${apps.length} 个应用:\n`);
  apps.forEach((app, i) => {
    console.log(`  [${i + 1}] ${app.name}`);
    console.log(`      ID: ${app.app_id}`);
  });
}

export function printForms(forms: FormInfo[]): void {
  if (forms.length === 0) { console.log('无表单'); return; }
  console.log(`共 ${forms.length} 个表单:\n`);
  forms.forEach((f, i) => {
    console.log(`  [${i + 1}] ${f.name}`);
    console.log(`      ID: ${f.entry_id}`);
  });
}

export interface WidgetInfo {
  label: string;
  type: string;
  items?: Record<string, WidgetInfo>;
}

const SYSTEM_FIELDS = new Set(['appId', 'entryId', 'creator', 'updater', 'deleter', 'createTime', 'updateTime', 'deleteTime', 'flowState']);

export async function confirm(msg: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${msg} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function ensureConfirm(msg: string, yes: boolean): Promise<void> {
  if (yes) return;
  const ok = await confirm(msg);
  if (!ok) { console.log('已取消'); process.exit(0); }
}

export function buildWidgetMap(widgets: { name: string; label: string; type: string; items?: { name: string; label: string; type: string }[] }[]): Record<string, WidgetInfo> {
  const map: Record<string, WidgetInfo> = {};
  for (const w of widgets) {
    const entry: WidgetInfo = { label: w.label, type: w.type };
    if (w.items) {
      entry.items = {};
      for (const item of w.items) {
        entry.items[item.name] = { label: item.label, type: item.type };
      }
    }
    map[w.name] = entry;
  }
  return map;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatFieldValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '-';
  switch (type) {
    case 'user': {
      const u = value as Record<string, unknown>;
      if (u?.name) return `${u.name}${u.username ? ` (${u.username})` : ''}`;
      return String(value);
    }
    case 'datetime': {
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? String(value) : formatDateTime(d);
    }
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

export function printDataList(records: Record<string, unknown>[], widgetMap?: Record<string, WidgetInfo>, total?: number): void {
  if (records.length === 0) { console.log('无数据'); return; }
  if (total !== undefined) console.log(`共 ${total} 条数据:\n`);

  let displayKey: string | undefined;
  if (widgetMap) {
    for (const key of Object.keys(records[0] ?? {})) {
      if (key !== '_id' && !SYSTEM_FIELDS.has(key) && widgetMap[key] && widgetMap[key].type !== 'subform') {
        displayKey = key;
        break;
      }
    }
  }

  records.forEach((r, i) => {
    if (displayKey && widgetMap?.[displayKey]) {
      const val = r[displayKey];
      console.log(`  [${i + 1}] ${val ?? '-'}`);
    } else {
      const name = (r['name'] as string) || (r['title'] as string) || '-';
      console.log(`  [${i + 1}] ${name} (ID: ${r['_id'] ?? '-'})`);
    }
  });
}

export function printDataDetail(data: Record<string, unknown>, widgetMap?: Record<string, WidgetInfo>): void {
  if (Object.keys(data).length === 0) { console.log('  无数据'); return; }

  const topFields: string[] = [];
  const subforms: [unknown, WidgetInfo][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === '_id' || SYSTEM_FIELDS.has(key)) continue;
    const info = widgetMap?.[key];
    if (info?.type === 'subform') {
      subforms.push([value, info]);
    } else if (info) {
      topFields.push(`${info.label}: ${formatFieldValue(value, info.type)}`);
    } else {
      topFields.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
    }
  }

  if (topFields.length > 0) {
    console.log('  ' + topFields.join('\n  '));
  }

  for (const [value, info] of subforms) {
    console.log(`\n  [${info.label}]`);
    const records = value as Record<string, unknown>[];
    if (!records || records.length === 0) { console.log('    无数据'); continue; }
    const subKeys = Object.keys(records[0]).filter(k => k !== '_id');
    for (let i = 0; i < records.length; i++) {
      console.log(`    项次 ${i + 1}:`);
      for (const k of subKeys) {
        const subInfo = info.items?.[k];
        if (subInfo) {
          console.log(`      ${subInfo.label}: ${formatFieldValue(records[i][k], subInfo.type)}`);
        } else {
          console.log(`      ${k}: ${String(records[i][k] ?? '-')}`);
        }
      }
    }
  }

  const sysInfo: Record<string, string> = {};
  if (data['_id']) sysInfo['数据ID'] = data['_id'] as string;
  if (data['createTime']) {
    const d = new Date(String(data['createTime']));
    sysInfo['创建时间'] = isNaN(d.getTime()) ? String(data['createTime']) : formatDateTime(d);
  }
  if (data['creator']) {
    const c = data['creator'] as Record<string, unknown>;
    sysInfo['创建人'] = (c?.name as string) ?? '-';
  }
  if (data['updateTime']) {
    const d = new Date(String(data['updateTime']));
    sysInfo['更新时间'] = isNaN(d.getTime()) ? String(data['updateTime']) : formatDateTime(d);
  }
  if (data['updater']) {
    const u = data['updater'] as Record<string, unknown>;
    sysInfo['更新人'] = (u?.name as string) ?? '-';
  }
  if (data['flowState'] != null) sysInfo['流程状态'] = String(data['flowState']);

  if (Object.keys(sysInfo).length > 0) {
    console.log('');
    for (const [k, v] of Object.entries(sysInfo)) {
      console.log(`  ${k}: ${v}`);
    }
  }
}

export function printWorkflowInstance(wf: WorkflowInstanceResponse): void {
  console.log(`  表单名称: ${wf.form_title}`);
  console.log(`  实例ID: ${wf.instance_id}`);
  console.log(`  创建人: ${formatUser(wf.creator)}`);
  console.log(`  创建时间: ${wf.create_time}`);
  console.log(`  结束时间: ${wf.finish_time ?? '进行中'}`);
  console.log(`  状态: ${formatInstanceStatus(wf.status)}`);
  if (wf.result !== undefined) {
    console.log(`  审批结果: ${wf.result === 1 ? '同意' : '否决'}`);
  }
  console.log(`  链接: ${wf.url}`);
  if (wf.tasks?.length > 0) {
    console.log(`  待办任务 (${wf.tasks.length}):`);
    wf.tasks.forEach((task, i) => {
      console.log(`    [${i + 1}] ${task.flow_name} - ${task.title}`);
      console.log(`        处理人: ${formatUser(task.assignee)}`);
      console.log(`        创建: ${formatAction(task.create_action)} @ ${task.create_time}`);
      if (task.finish_action) console.log(`        完成: ${formatAction(task.finish_action)} @ ${task.finish_time ?? '-'}`);
      console.log(`        状态: ${formatTaskStatus(task.status)}`);
    });
  }
}

export function printLog(index: number, log: WorkflowLog): void {
  console.log(`    [${index}] 节点: ${log.flow_name}`);
  console.log(`        操作人: ${formatUser(log.operator)}`);
  console.log(`        操作: ${formatAction(log.create_action)} -> ${formatAction(log.finish_action)}`);
  console.log(`        时间: ${log.create_time} ~ ${log.finish_time}`);
  if (log.comment) console.log(`        意见: ${log.comment}`);
  if (log.signature?.url) console.log(`        签名: ${log.signature.url}`);
}

export function printComment(index: number, comment: ApprovalComment): void {
  console.log(`    [${index}] 节点: ${comment.flowNodeName}`);
  console.log(`        操作人: ${formatUser(comment.operator)}`);
  console.log(`        动作: ${formatAction(comment.flowAction)}`);
  if (comment.comment) console.log(`        意见: ${comment.comment}`);
  if (comment.signature_url) console.log(`        签名: ${comment.signature_url}`);
}

export function printTasks(tasks: TaskItem[]): void {
  if (tasks.length === 0) { console.log('无待办任务'); return; }
  console.log(`共 ${tasks.length} 个待办:\n`);
  tasks.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.title}`);
    console.log(`      表单: ${t.form_title}`);
    console.log(`      节点: ${t.flow_name}`);
    console.log(`      处理人: ${formatUser(t.assignee)}`);
    console.log(`      创建时间: ${t.create_time}`);
    console.log(`      状态: ${formatTaskStatus(t.status)}`);
    console.log(`      ID: ${t.task_id}`);
  });
}

export function printUsers(users: { name?: string; username?: string; status?: number; departments?: number[] }[]): void {
  if (users.length === 0) { console.log('无成员'); return; }
  console.log(`共 ${users.length} 个成员:\n`);
  users.forEach((u, i) => {
    console.log(`  [${i + 1}] ${u.name ?? '-'} (${u.username ?? '-'})`);
    console.log(`      状态: ${u.status === 1 ? '激活' : u.status === -1 ? '删除' : '禁用'}`);
    if (u.departments?.length) console.log(`      部门: ${u.departments.join(', ')}`);
  });
}

export function printWidgets(widgets: { name: string; widgetName: string; label: string; type: string }[]): void {
  if (widgets.length === 0) { console.log('无字段'); return; }
  console.log(`共 ${widgets.length} 个字段:\n`);
  widgets.forEach((w, i) => {
    console.log(`  [${i + 1}] ${w.label}`);
    console.log(`      类型: ${w.type}`);
    console.log(`      标识: ${w.widgetName}`);
  });
}

export function printDeptTree(
  depts: DeptInfo[],
  rootNo: number,
  getMembers: (deptNo: number) => { name: string; username: string }[],
  level = 0,
  maxDepth = 20,
): void {
  if (level > maxDepth) return;
  const indent = '  '.repeat(level);
  const children = depts.filter(d => d.parent_no === rootNo)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  for (const dept of children) {
    console.log(`${indent}📁 ${dept.name} (${dept.dept_no})`);
    const members = getMembers(dept.dept_no);
    for (const m of members) {
      console.log(`${indent}  👤 ${m.name} (${m.username})`);
    }
    printDeptTree(depts, dept.dept_no, getMembers, level + 1, maxDepth);
  }
}

export function printCcList(items: CcItem[]): void {
  if (items.length === 0) { console.log('无抄送'); return; }
  console.log(`共 ${items.length} 条抄送:\n`);
  items.forEach((c, i) => {
    console.log(`  [${i + 1}] ${c.form_title} - ${c.title}`);
    console.log(`      抄送人: ${formatUser(c.assignee)}`);
    console.log(`      发起人: ${formatUser(c.creator)}`);
    console.log(`      状态: ${c.status === 1 ? '已读' : '未读'}`);
    console.log(`      时间: ${c.start_time}`);
  });
}

export function printRoles(roles: RoleInfo[]): void {
  if (roles.length === 0) { console.log('无角色'); return; }
  console.log(`共 ${roles.length} 个角色:\n`);
  roles.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.name} (编号: ${r.role_no})`);
  });
}

export function printRoleGroups(groups: RoleGroupInfo[]): void {
  if (groups.length === 0) { console.log('无角色组'); return; }
  console.log(`共 ${groups.length} 个角色组:\n`);
  groups.forEach((g, i) => {
    console.log(`  [${i + 1}] ${g.name} (编号: ${g.group_no})`);
  });
}

export function printGuestDepts(depts: GuestDeptInfo[]): void {
  if (depts.length === 0) { console.log('无互联企业部门'); return; }
  console.log(`共 ${depts.length} 个互联企业部门:\n`);
  depts.forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.name} (编号: ${d.dept_no})`);
  });
}

export function printGuestUsers(users: GuestUserInfo[]): void {
  if (users.length === 0) { console.log('无外部对接人'); return; }
  console.log(`共 ${users.length} 个外部对接人:\n`);
  users.forEach((u, i) => {
    console.log(`  [${i + 1}] ${u.name} (${u.username})`);
    if (u.departments?.length) console.log(`      部门: ${u.departments.join(', ')}`);
  });
}

function printMetrics(metrics: UsageMetrics, indent: string): void {
  console.log(`${indent}应用数: ${metrics.app}`);
  console.log(`${indent}普通表单: ${metrics.form_coop}`);
  console.log(`${indent}流程表单: ${metrics.form_workflow}`);
  console.log(`${indent}仪表盘: ${metrics.dash}`);
  console.log(`${indent}数据工厂: ${metrics.etl}`);
  console.log(`${indent}聚合表: ${metrics.aggregate}`);
  console.log(`${indent}公开链接: ${metrics.public_link}`);
  console.log(`${indent}智能助手: ${metrics.data_trigger}`);
  console.log(`${indent}高级流程: ${metrics.automation}`);
  console.log(`${indent}流程分析: ${metrics.bpa}`);
  console.log(`${indent}数据总量: ${metrics.data}`);
}

export function printUsageOverview(date: string, metrics: UsageMetrics): void {
  console.log(`  统计日期: ${date}\n`);
  printMetrics(metrics, '  ');
}

export function printUsageAppItems(items: UsageAppItem[]): void {
  if (items.length === 0) { console.log('无数据'); return; }
  console.log('');
  items.forEach((item, i) => {
    console.log(`  [${i + 1}] ${item.app_name} (${item.app_id})`);
    console.log(`      创建者: ${item.creator?.name ?? '-'}`);
    printMetrics(item.metrics, '      ');
    console.log('');
  });
}

export function printUsageMemberItems(items: UsageMemberItem[]): void {
  if (items.length === 0) { console.log('无数据'); return; }
  console.log('');
  items.forEach((item, i) => {
    console.log(`  [${i + 1}] ${item.member.name} (${item.member.member_id})`);
    printMetrics(item.metrics, '      ');
    console.log('');
  });
}

export function printAuditLogs(items: AuditLogItem[]): void {
  if (items.length === 0) { console.log('无审计日志'); return; }
  console.log(`共 ${items.length} 条:\n`);
  items.forEach((item, i) => {
    console.log(`  [${i + 1}] ${item.event_type}`);
    console.log(`      时间: ${item.event_time}`);
    console.log(`      操作人: ${item.actor.name} (${item.actor.ip})`);
    console.log(`      资源: ${item.resource.name} (${item.resource.type})`);
    console.log(`      结果: ${item.event.outcome}`);
  });
}

export function printAuditLogDomains(domains: AuditLogDomain[]): void {
  if (domains.length === 0) { console.log('无日志类型'); return; }
  console.log(`共 ${domains.length} 个日志范围:\n`);
  domains.forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.domain}`);
    console.log(`      事件类型: ${d.event_types.join(', ')}`);
  });
}
