import { Command } from 'commander';
import { JdyClient } from '../client';
import { printWorkflowInstance, printLog, printComment, printTasks, printCcList, ensureConfirm } from '../utils';

function parseJSON(data: string): Record<string, unknown> {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('JSON 格式错误:', (e as Error).message);
    process.exit(1);
  }
}

let json = () => false;

function getUsername(options: { username?: string }): string {
  return options.username || process.env.JDY_USERNAME || '';
}

function requireUsername(username: string): boolean {
  if (!username) {
    if (json()) { console.log(JSON.stringify({ error: '请指定 --username 或设置 JDY_USERNAME 环境变量' })); return false; }
    console.log('请指定 --username 或设置 JDY_USERNAME 环境变量');
    return false;
  }
  return true;
}

function addCommonTaskOptions(cmd: Command): Command {
  return cmd
    .option('-u, --username <username>', '用户名（默认 $JDY_USERNAME）')
    .option('-c, --comment <text>', '审批意见')
    .option('--dry-run', '预览不执行', false)
    .option('--yes', '跳过确认', false);
}

function handleDryRun(action: string, params: Record<string, unknown>): boolean {
  console.log(`预览: ${action}`);
  console.log(JSON.stringify(params, null, 2));
  return true;
}

export function register(program: Command, getClient: () => JdyClient): void {
  const wf = program.command('workflow').description('流程接口');
  json = () => program.optsWithGlobals().json;

  wf
    .command('instance-get')
    .argument('<instanceId>', '流程实例ID')
    .description('查询流程实例信息')
    .option('--tasks-type <number>', '任务类型: 0-全部, 1-待办', '1')
    .action(async (instanceId, options) => {
      const res = await getClient().getWorkflowInstance(instanceId, Number(options.tasksType));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printWorkflowInstance(res);
    });

  wf
    .command('log')
    .argument('<instanceId>', '流程实例ID')
    .description('查询流程日志')
    .option('--types <list>', '日志类型: comment,signature,attachment', 'comment')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (instanceId, options) => {
      const types = options.types.split(',');
      const res = await getClient().getWorkflowLogs(instanceId, types, Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      res.logs.forEach((log, i) => printLog(i + 1, log));
    });

  wf
    .command('task-list')
    .description('查询我的待办')
    .option('-u, --username <username>', '用户名')
    .option('--limit <number>', '每页数', '100')
    .option('--all', '自动翻页获取全部数据', false)
    .option('--page-size <number>', '翻页时每页条数')
    .action(async (options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      if (options.all) {
        const res = await getClient().listAllTasks(username, {
          pageSize: options.pageSize ? Number(options.pageSize) : Number(options.limit),
        });
        if (json()) { console.log(JSON.stringify(res)); return; }
        printTasks(res.tasks);
        return;
      }
      const res = await getClient().listMyTasks(username, { limit: Number(options.limit) });
      if (json()) { console.log(JSON.stringify(res)); return; }
      printTasks(res.tasks);
    });

  wf
    .command('comments')
    .argument('<appId>', '应用ID')
    .argument('<entryId>', '表单ID')
    .argument('<dataId>', '数据ID')
    .description('查询审批意见')
    .option('--skip <number>', '跳过数', '0')
    .action(async (appId, entryId, dataId, options) => {
      const res = await getClient().getApprovalComments(appId, entryId, dataId, Number(options.skip));
      if (json()) { console.log(JSON.stringify(res)); return; }
      res.approveCommentList.forEach((c, i) => printComment(i + 1, c));
    });

  wf
    .command('cc-list')
    .description('查询抄送列表')
    .option('--username <username>', '用户名')
    .option('--read-status <status>', '读取状态: read, unread, all', 'all')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '10')
    .option('--all', '自动翻页获取全部数据', false)
    .option('--page-size <number>', '翻页时每页条数')
    .action(async (options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      if (options.all) {
        const res = await getClient().listAllCcList(username, {
          pageSize: options.pageSize ? Number(options.pageSize) : Number(options.limit),
          read_status: ['read', 'unread'].includes(options.readStatus) ? options.readStatus : undefined,
        });
        if (json()) { console.log(JSON.stringify(res)); return; }
        printCcList(res.cc_list);
        return;
      }
      const res = await getClient().listCcList(username, {
        skip: Number(options.skip),
        limit: Number(options.limit),
        read_status: options.readStatus,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      printCcList(res.cc_list);
    });

  // === WORKFLOW ACTION COMMANDS ===

  const task = wf.command('task').description('流程任务操作');

  addCommonTaskOptions(
    task
      .command('approve <taskId>')
      .description('审批通过')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params = { username, instance_id: options.instance, task_id: taskId, comment: options.comment };
      if (options.dryRun) { handleDryRun('审批通过', params); return; }
      await ensureConfirm('确认审批通过?', options.yes);
      const res = await getClient().approveTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '审批通过成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('reject <taskId>')
      .description('否决')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params = { instance_id: options.instance, task_id: taskId, username, comment: options.comment };
      if (options.dryRun) { handleDryRun('否决', params); return; }
      await ensureConfirm('确认否决?', options.yes);
      const res = await getClient().rejectTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '否决成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('back <taskId>')
      .description('回退到指定节点')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
      .option('-n, --node <flowId>', '回退目标节点 flow_id')
      .option('--back-type <type>', '回退人选择: normal(正常流转), direct(直达目标节点)')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params: { username: string; instance_id: string; task_id: string; flow_id?: number; comment?: string; back_type?: number } = { username, instance_id: options.instance, task_id: taskId };
      if (options.comment) params.comment = options.comment;
      if (options.node) params.flow_id = Number(options.node);
      if (options.backType) {
        if (options.backType === 'direct') params.back_type = 2;
        else if (options.backType === 'normal') params.back_type = 1;
      }
      if (options.dryRun) { handleDryRun('回退', params); return; }
      await ensureConfirm('确认回退?', options.yes);
      const res = await getClient().rollbackTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '回退成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('transfer <taskId>')
      .description('转交')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
      .requiredOption('--to <username>', '转交目标用户')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params = { username, instance_id: options.instance, task_id: taskId, transfer_username: options.to, comment: options.comment };
      if (options.dryRun) { handleDryRun('转交', params); return; }
      await ensureConfirm(`确认转交给 ${options.to}?`, options.yes);
      const res = await getClient().transferTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '转交成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('add-sign <taskId>')
      .description('加签')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
      .requiredOption('--add-user <username>', '被加签人用户名')
      .requiredOption('--add-type <type>', '加签类型: before(前加签), after(后加签), parallel(并加签)')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const typeMap: Record<string, number> = { before: 0, after: 1, parallel: 2 };
      const addSignType = typeMap[options.addType];
      if (addSignType === undefined) {
        console.log('无效的加签类型，可选: before, after, parallel'); return;
      }
      const params = { instance_id: options.instance, task_id: taskId, username, add_sign_type: addSignType, add_sign_username: options.addUser, comment: options.comment };
      if (options.dryRun) { handleDryRun('加签', params); return; }
      await ensureConfirm(`确认加签给 ${options.addUser}?`, options.yes);
      const res = await getClient().addSignTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '加签成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('submit <taskId>')
      .description('提交（同 approve）')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params = { username, instance_id: options.instance, task_id: taskId, comment: options.comment };
      if (options.dryRun) { handleDryRun('提交', params); return; }
      await ensureConfirm('确认提交?', options.yes);
      const res = await getClient().approveTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '提交成功' : `失败: ${res.message}`);
    });

  addCommonTaskOptions(
    task
      .command('submit-and-print <taskId>')
      .description('提交并打印（同 approve）')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params = { username, instance_id: options.instance, task_id: taskId, comment: options.comment };
      if (options.dryRun) { handleDryRun('提交并打印', params); return; }
      await ensureConfirm('确认提交并打印?', options.yes);
      const res = await getClient().approveTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '提交并打印成功' : `失败: ${res.message}`);
    });

  task
    .command('save')
    .description('暂存（保存表单数据，不流转）')
    .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
    .requiredOption('--app-id <appId>', '应用ID')
    .requiredOption('--entry-id <entryId>', '表单ID')
    .requiredOption('--data <json>', '表单数据 (JSON)')
    .option('--dry-run', '预览不执行', false)
    .option('--yes', '跳过确认', false)
    .action(async (options) => {
      const raw = parseJSON(options.data);
      if (options.dryRun) { console.log(`预览: 暂存数据到 ${options.instance}`); console.log(JSON.stringify(raw, null, 2)); return; }
      await ensureConfirm('确认暂存?', options.yes);
      const res = await getClient().updateData({
        app_id: options.appId,
        entry_id: options.entryId,
        data_id: options.instance,
        data: raw,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('暂存成功');
    });

  task
    .command('save-and-print')
    .description('暂存并打印（保存表单数据，不流转）')
    .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
    .requiredOption('--app-id <appId>', '应用ID')
    .requiredOption('--entry-id <entryId>', '表单ID')
    .requiredOption('--data <json>', '表单数据 (JSON)')
    .option('--dry-run', '预览不执行', false)
    .option('--yes', '跳过确认', false)
    .action(async (options) => {
      const raw = parseJSON(options.data);
      if (options.dryRun) { console.log(`预览: 暂存并打印数据到 ${options.instance}`); console.log(JSON.stringify(raw, null, 2)); return; }
      await ensureConfirm('确认暂存并打印?', options.yes);
      const res = await getClient().updateData({
        app_id: options.appId,
        entry_id: options.entryId,
        data_id: options.instance,
        data: raw,
      });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('暂存并打印成功');
    });

  addCommonTaskOptions(
    task
      .command('recall <taskId>')
      .description('撤回待办')
      .requiredOption('-i, --instance <id>', '流程实例ID（同 data_id）')
      .option('--source-task <taskId>', '撤回的源待办ID（不传默认撤回发起节点）')
  )
    .action(async (taskId, options) => {
      const username = getUsername(options);
      if (!requireUsername(username)) return;
      const params: { instance_id: string; task_id?: string; username: string; comment?: string } = { instance_id: options.instance, username, comment: options.comment };
      if (options.sourceTask) params.task_id = options.sourceTask;
      if (options.dryRun) { handleDryRun('撤回', params); return; }
      await ensureConfirm('确认撤回?', options.yes);
      const res = await getClient().revokeTask(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '撤回成功' : `失败: ${res.message}`);
    });

  const inst = wf.command('instance').description('流程实例操作');

  inst
    .command('close <instanceId>')
    .description('结束流程实例（管理员）')
    .option('--dry-run', '预览不执行', false)
    .option('--yes', '跳过确认', false)
    .action(async (instanceId, options) => {
      if (options.dryRun) { handleDryRun('结束流程实例', { instance_id: instanceId }); return; }
      await ensureConfirm(`确认结束流程实例 ${instanceId}?`, options.yes);
      const res = await getClient().closeInstance({ instance_id: instanceId });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '结束成功' : `失败: ${res.message}`);
    });

  inst
    .command('activate <instanceId>')
    .description('激活流程实例（管理员）')
    .requiredOption('-n, --node <flowId>', '激活的节点 flow_id')
    .option('--dry-run', '预览不执行', false)
    .option('--yes', '跳过确认', false)
    .action(async (instanceId, options) => {
      if (options.dryRun) { handleDryRun('激活流程实例', { instance_id: instanceId, flow_id: Number(options.node) }); return; }
      await ensureConfirm(`确认激活流程实例 ${instanceId}?`, options.yes);
      const res = await getClient().activateInstance({ instance_id: instanceId, flow_id: Number(options.node) });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(res.status === 'success' ? '激活成功' : `失败: ${res.message}`);
    });
}
