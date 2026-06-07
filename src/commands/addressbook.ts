import { Command } from 'commander';
import { JdyClient } from '../client';
import { printDeptTree, printUsers, printRoles, printRoleGroups, printGuestDepts, printGuestUsers, ensureConfirm } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

function safeResolvePath(filePath: string, baseDir = process.cwd()): string {
  const resolved = path.resolve(baseDir, filePath);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    console.error(`不允许访问基目录之外的路径: ${filePath}`);
    process.exit(1);
  }
  return resolved;
}

function resolveDataFile(data: string): unknown {
  if (data.startsWith('@')) {
    const filePath = safeResolvePath(data.slice(1));
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`读取文件失败: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('JSON 格式错误:', (e as Error).message);
    process.exit(1);
  }
}

export function register(program: Command, getClient: () => JdyClient): void {
  const ab = program.command('addressbook').description('通讯录接口');
  const json = () => program.optsWithGlobals().json;

  ab
    .command('user-get')
    .argument('<username>', '用户名')
    .description('获取成员信息')
    .action(async (username) => {
      const res = await getClient().getUserInfo(username);
      if (json()) { console.log(JSON.stringify(res)); return; }
      const u = res.user;
      console.log(`  姓名: ${u.name ?? '-'}`);
      console.log(`  用户名: ${u.username ?? '-'}`);
      console.log(`  状态: ${u.status === 1 ? '激活' : '禁用'}`);
      console.log(`  类型: ${u.type === 1 ? '成员' : '客户'}`);
      console.log(`  部门: ${u.departments?.join(', ') ?? '-'}`);
      if (u.integrate_id) console.log(`  集成ID: ${u.integrate_id}`);
    });

  ab
    .command('user-list')
    .argument('[deptNo]', '部门编号', '1')
    .description('查询部门下的成员')
    .option('--all', '递归获取所有子部门成员', false)
    .action(async (deptNo, options) => {
      const res = await getClient().listDepartmentMembers(Number(deptNo), options.all);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printUsers(res.users);
    });

  ab
    .command('dept-list')
    .argument('[deptNo]', '部门编号', '1')
    .description('递归查询部门列表')
    .option('--tree', '树形显示', false)
    .action(async (deptNo, options) => {
      const client = getClient();
      const deptNum = Number(deptNo);

      if (options.tree) {
        const deptRes = await client.listDepartments(deptNum, true);
        const memberCache = new Map<number, { name: string; username: string }[]>();
        const chunkSize = 5;
        for (let i = 0; i < deptRes.departments.length; i += chunkSize) {
          const chunk = deptRes.departments.slice(i, i + chunkSize);
          const results = await Promise.allSettled(
            chunk.map(d => client.listDepartmentMembers(d.dept_no, false))
          );
          results.forEach((result, j) => {
            if (result.status === 'fulfilled') {
              const d = chunk[j];
              memberCache.set(d.dept_no, result.value.users.filter(u => u.status === 1).map(u => ({
                name: u.name ?? u.username ?? '-',
                username: u.username ?? '-',
              })));
            }
          });
        }
        if (json()) {
          const tree = buildTree(deptRes.departments, deptNum, (dno: number) => memberCache.get(dno) ?? []);
          console.log(JSON.stringify(tree));
          return;
        }
        printDeptTree(deptRes.departments, deptNum, (dno: number) => memberCache.get(dno) ?? []);
      } else {
        const res = await client.listDepartments(deptNum, true);
        if (json()) { console.log(JSON.stringify(res)); return; }
        console.log(`共 ${res.departments.length} 个部门:`);
        for (const d of res.departments) {
          console.log(`  ${d.name} (ID: ${d.dept_no}, 父级: ${d.parent_no})`);
        }
      }
    });

  ab
    .command('role-list')
    .description('列出角色')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (options) => {
      const res = await getClient().listRoles(Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printRoles(res.roles);
    });

  ab
    .command('role-user-list')
    .description('列出角色下的成员')
    .requiredOption('--role-no <number>', '角色编号')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (options) => {
      const res = await getClient().listRoleUsers(Number(options.roleNo), Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printUsers(res.users);
    });

  ab
    .command('role-create')
    .argument('<name>', '角色名称')
    .description('创建自建角色')
    .requiredOption('-g, --group-no <number>', '角色组编号', Number)
    .action(async (name, options) => {
      const res = await getClient().createRole({ name, group_no: options.groupNo });
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('角色创建成功:');
      console.log(`  编号: ${res.role.role_no}`);
      console.log(`  名称: ${res.role.name}`);
      console.log(`  角色组: ${res.role.group_no}`);
    });

  ab
    .command('role-update')
    .argument('<roleNo>', '角色编号', Number)
    .description('更新自建角色')
    .requiredOption('-g, --group-no <number>', '角色组编号', Number)
    .option('-n, --name <name>', '新角色名称')
    .action(async (roleNo, options) => {
      const params: { role_no: number; group_no: number; name?: string } = { role_no: roleNo, group_no: options.groupNo };
      if (options.name) params.name = options.name;
      const res = await getClient().updateRole(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('角色已更新:');
      console.log(`  编号: ${res.role.role_no}`);
      console.log(`  名称: ${res.role.name}`);
    });

  ab
    .command('role-delete')
    .argument('<roleNo>', '角色编号', Number)
    .description('删除自建角色')
    .option('--yes', '跳过确认', false)
    .action(async (roleNo, options) => {
      await ensureConfirm(`确认删除角色 ${roleNo}?`, options.yes);
      const res = await getClient().deleteRole(roleNo);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`角色 ${roleNo} 已删除`);
    });

  ab
    .command('role-add-members')
    .argument('<roleNo>', '角色编号', Number)
    .description('为角色批量添加成员')
    .requiredOption('-u, --usernames <list>', '成员编号列表 (逗号分隔)')
    .action(async (roleNo, options) => {
      const list = options.usernames.split(',');
      const res = await getClient().addRoleMembers(roleNo, list);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`角色 ${roleNo} 添加 ${list.length} 个成员: ${res.status}`);
    });

  ab
    .command('role-remove-members')
    .argument('<roleNo>', '角色编号', Number)
    .description('为角色批量移除成员')
    .requiredOption('-u, --usernames <list>', '成员编号列表 (逗号分隔)')
    .action(async (roleNo, options) => {
      const list = options.usernames.split(',');
      const res = await getClient().removeRoleMembers(roleNo, list);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`角色 ${roleNo} 移除 ${list.length} 个成员: ${res.status}`);
    });

  ab
    .command('role-group-list')
    .description('列出角色组')
    .option('--skip <number>', '跳过数', '0')
    .option('--limit <number>', '每页数', '100')
    .action(async (options) => {
      const res = await getClient().listRoleGroups(Number(options.skip), Number(options.limit));
      if (json()) { console.log(JSON.stringify(res)); return; }
      printRoleGroups(res.role_groups);
    });

  ab
    .command('role-group-create')
    .argument('<name>', '角色组名称')
    .description('创建自建角色组')
    .action(async (name, options) => {
      const res = await getClient().createRoleGroup(name);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('角色组创建成功:');
      console.log(`  编号: ${res.role_group.group_no}`);
      console.log(`  名称: ${res.role_group.name}`);
    });

  ab
    .command('role-group-update')
    .argument('<groupNo>', '角色组编号', Number)
    .argument('<name>', '新角色组名称')
    .description('更新自建角色组')
    .action(async (groupNo, name, options) => {
      const res = await getClient().updateRoleGroup(groupNo, name);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('角色组已更新:');
      console.log(`  编号: ${res.role_group.group_no}`);
      console.log(`  名称: ${res.role_group.name}`);
    });

  ab
    .command('role-group-delete')
    .argument('<groupNo>', '角色组编号', Number)
    .description('删除自建角色组')
    .option('--yes', '跳过确认', false)
    .action(async (groupNo, options) => {
      await ensureConfirm(`确认删除角色组 ${groupNo}?`, options.yes);
      const res = await getClient().deleteRoleGroup(groupNo);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`角色组 ${groupNo} 已删除`);
    });

  ab
    .command('guest-dept-list')
    .argument('[deptNo]', '部门编号')
    .description('查询互联企业部门')
    .action(async (deptNo) => {
      const res = await getClient().listGuestDepartments(deptNo ? Number(deptNo) : undefined);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printGuestDepts(res.dept_list);
    });

  ab
    .command('guest-user-list')
    .argument('[deptNo]', '部门编号')
    .description('查询互联企业外部对接人列表')
    .action(async (deptNo) => {
      const res = await getClient().listGuestUsers(deptNo ? Number(deptNo) : undefined);
      if (json()) { console.log(JSON.stringify(res)); return; }
      printGuestUsers(res.member_list);
    });

  ab
    .command('guest-user-get')
    .argument('<username>', '成员编号')
    .description('查询互联企业外部对接人详情')
    .action(async (username) => {
      const res = await getClient().getGuestUser(username);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`  姓名: ${res.member.name}`);
      console.log(`  用户名: ${res.member.username}`);
      console.log(`  部门: ${res.member.departments?.join(', ') ?? '-'}`);
    });

  // === WRITE ===
  ab
    .command('user-create')
    .argument('<name>', '成员名称')
    .description('创建成员')
    .option('-u, --username <username>', '成员编号(自动生成)')
    .option('-d, --departments <depts>', '所属部门编号,逗号分隔', (v) => v.split(',').map(Number))
    .action(async (name, options) => {
      const params: { name: string; username?: string; departments?: number[] } = { name };
      if (options.username) params.username = options.username;
      if (options.departments) params.departments = options.departments;
      const res = await getClient().createUser(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('成员创建成功:');
      console.log(`  用户名: ${res.user.username}`);
      console.log(`  姓名: ${res.user.name}`);
      console.log(`  部门: ${res.user.departments?.join(', ') ?? '-'}`);
    });

  ab
    .command('user-update')
    .argument('<username>', '成员编号')
    .description('修改成员(成员编号不可修改)')
    .option('-n, --name <name>', '新名称')
    .option('-d, --departments <depts>', '新部门编号,逗号分隔', (v) => v.split(',').map(Number))
    .action(async (username, options) => {
      const params: { username: string; name?: string; departments?: number[] } = { username };
      if (options.name) params.name = options.name;
      if (options.departments) params.departments = options.departments;
      if (!options.name && !options.departments) {
        console.error('至少提供 --name 或 --departments');
        process.exit(1);
      }
      const res = await getClient().updateUser(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('成员已更新');
      console.log(`  用户名: ${res.user.username}`);
      console.log(`  姓名: ${res.user.name}`);
      console.log(`  部门: ${res.user.departments?.join(', ') ?? '-'}`);
    });

  ab
    .command('user-delete')
    .argument('<username>', '成员编号')
    .description('删除成员(标记为离职)')
    .option('--yes', '跳过确认', false)
    .action(async (username, options) => {
      await ensureConfirm(`确认删除成员 ${username}?`, options.yes);
      const res = await getClient().deleteUser(username);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`成员 ${username} 已删除(离职)`);
    });

  ab
    .command('batch-delete-users')
    .argument('<usernames>', '成员编号列表 (逗号分隔)')
    .description('批量删除成员(标记为离职)')
    .option('--yes', '跳过确认', false)
    .action(async (usernames, options) => {
      const list = usernames.split(',');
      await ensureConfirm(`确认删除 ${list.length} 个成员?`, options.yes);
      const res = await getClient().batchDeleteUsers(list);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`批量删除完成: ${res.status}`);
    });

  ab
    .command('user-import')
    .argument('<data>', 'JSON 字符串或 @文件路径')
    .description('增量导入成员 (upsert)')
    .action(async (data, options) => {
      const raw = resolveDataFile(data) as any;
      const users = Array.isArray(raw) ? raw : raw.users;
      if (!users) { console.error('数据格式错误: 需要数组或 {users: [...]}'); process.exit(1); }
      const res = await getClient().importUsers(users);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`导入完成: ${res.status}`);
    });

  ab
    .command('dept-create')
    .argument('<name>', '部门名称')
    .description('创建部门')
    .option('-p, --parent-no <number>', '父部门编号', Number)
    .option('-d, --dept-no <number>', '部门编号(自动生成)', Number)
    .action(async (name, options) => {
      const params: { name: string; parent_no?: number; dept_no?: number } = { name };
      if (options.parentNo !== undefined) params.parent_no = options.parentNo;
      if (options.deptNo !== undefined) params.dept_no = options.deptNo;
      const res = await getClient().createDepartment(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('部门创建成功:');
      console.log(`  编号: ${res.department.dept_no}`);
      console.log(`  名称: ${res.department.name}`);
      console.log(`  父部门: ${res.department.parent_no}`);
    });

  ab
    .command('dept-update')
    .argument('<deptNo>', '部门编号', Number)
    .description('修改部门')
    .option('-n, --name <name>', '新部门名称')
    .option('-p, --parent-no <number>', '新父部门编号', Number)
    .option('-s, --seq <number>', '部门排序', Number)
    .action(async (deptNo, options) => {
      const params: { dept_no: number; name?: string; parent_no?: number; seq?: number } = { dept_no: deptNo };
      if (options.name !== undefined) params.name = options.name;
      if (options.parentNo !== undefined) params.parent_no = options.parentNo;
      if (options.seq !== undefined) params.seq = options.seq;
      if (options.name === undefined && options.parentNo === undefined && options.seq === undefined) {
        console.error('至少提供 --name, --parent-no 或 --seq');
        process.exit(1);
      }
      const res = await getClient().updateDepartment(params);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log('部门已更新:');
      console.log(`  编号: ${res.department.dept_no}`);
      console.log(`  名称: ${res.department.name}`);
      console.log(`  父部门: ${res.department.parent_no}`);
    });

  ab
    .command('dept-delete')
    .argument('<deptNo>', '部门编号', Number)
    .description('删除部门')
    .option('--yes', '跳过确认', false)
    .action(async (deptNo, options) => {
      await ensureConfirm(`确认删除部门 ${deptNo}?`, options.yes);
      const res = await getClient().deleteDepartment(deptNo);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`部门 ${deptNo} 已删除`);
    });

  ab
    .command('dept-no-get')
    .argument('<integrateId>', '第三方平台部门ID')
    .description('获取集成模式部门编号')
    .action(async (integrateId, options) => {
      const res = await getClient().getDeptNoByIntegrateId(integrateId);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`  编号: ${res.department.dept_no}`);
      console.log(`  名称: ${res.department.name}`);
      console.log(`  父部门: ${res.department.parent_no}`);
    });

  ab
    .command('dept-import')
    .argument('<data>', 'JSON 字符串或 @文件路径')
    .description('全量导入部门 (覆盖部门树)')
    .action(async (data, options) => {
      const raw = resolveDataFile(data) as any;
      const departments = Array.isArray(raw) ? raw : raw.departments;
      if (!departments) { console.error('数据格式错误: 需要数组或 {departments: [...]}'); process.exit(1); }
      const res = await getClient().importDepartments(departments);
      if (json()) { console.log(JSON.stringify(res)); return; }
      console.log(`导入完成: ${res.status}`);
    });
}

function buildTree(
  depts: { dept_no: number; name: string; parent_no: number }[],
  rootNo: number,
  getMembers: (dno: number) => { name: string; username: string }[],
): Record<string, unknown>[] {
  const children = depts.filter(d => d.parent_no === rootNo);
  return children.map(d => ({
    dept_no: d.dept_no,
    name: d.name,
    members: getMembers(d.dept_no),
    children: buildTree(depts, d.dept_no, getMembers),
  }));
}
