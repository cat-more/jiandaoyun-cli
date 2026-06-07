import axios, { AxiosInstance, AxiosError } from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import {
  ListAppsResponse, ListFormsResponse, GetFormResponse, ListWidgetsResponse,
  ListDataResponse, GetDataResponse, CreateDataResponse, BatchCreateDataResponse,
  UpdateDataResponse, BatchUpdateDataResponse, DeleteDataResponse, BatchDeleteDataResponse,
  WorkflowInstanceResponse, WorkflowLogsResponse, ApprovalCommentsResponse, ListTasksResponse,
  GetUserInfoResponse, ListDeptMembersResponse, ListDepartmentsResponse, ListRolesResponse,
  ListRoleUsersResponse, ListRoleGroupsResponse, GuestDeptListResponse,
  WorkflowCcListResponse, CcItem,
  CorpUsageOverviewResponse, CorpUsageAppMetricsResponse, CorpUsageMemberMetricsResponse,
  AuditLogListResponse, AuditLogDomainsResponse, AuditLogItem, TaskItem,
  WorkflowActionResponse,
  CreateUserResponse, UpdateUserResponse, DeleteUserResponse, BatchDeleteUserResponse,
  CreateDepartmentResponse, UpdateDepartmentResponse, DeleteDepartmentResponse,
  GetUploadTokenResponse, ListGuestUsersResponse, GetGuestUserResponse,
  ImportUsersResponse, GetDeptNoResponse, ImportDepartmentsResponse,
  CreateRoleResponse, UpdateRoleResponse, DeleteRoleResponse,
  AddRoleMembersResponse, RemoveRoleMembersResponse,
  CreateRoleGroupResponse, UpdateRoleGroupResponse, DeleteRoleGroupResponse,
} from './types';

const BASE_URL = 'https://api.jiandaoyun.com/api';
const MAX_PAGES = 100;
const MAX_PAGE_SIZE = 500;

export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class JdyClient {
  private http: AxiosInstance;
  maxUploadSize: number;

  constructor(apiKey: string, maxUploadSize = 100 * 1024 * 1024) {
    this.maxUploadSize = maxUploadSize;
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async post<T>(url: string, body?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.http.post<T>(url, body);
      return res.data;
    } catch (e) {
      if (e instanceof AxiosError && e.response) {
        const msg = (e.response.data as any)?.msg || e.message;
        throw new ApiError(e.response.status, `[${e.response.status}] ${msg}`);
      }
      throw e;
    }
  }

  // === APP ===
  listApps(skip = 0, limit = 100): Promise<ListAppsResponse> {
    return this.post('/v5/app/list', { skip, limit });
  }

  listForms(appId: string, skip = 0, limit = 100): Promise<ListFormsResponse> {
    return this.post('/v5/app/entry/list', { app_id: appId, skip, limit });
  }

  getForm(appId: string, entryId: string): Promise<GetFormResponse> {
    return this.post('/v5/app/entry/get', { app_id: appId, entry_id: entryId });
  }

  listWidgets(appId: string, entryId: string): Promise<ListWidgetsResponse> {
    return this.post('/v5/app/entry/widget/list', { app_id: appId, entry_id: entryId });
  }

  // === DATA ===
  listData(appId: string, entryId: string, params: {
    data_id?: string;
    limit?: number;
    filter?: Record<string, unknown>;
    fields?: string[];
  } = {}): Promise<ListDataResponse> {
    return this.post('/v5/app/entry/data/list', {
      app_id: appId,
      entry_id: entryId,
      ...params,
    });
  }

  async listAllData(appId: string, entryId: string, params: {
    pageSize?: number;
    filter?: Record<string, unknown>;
    fields?: string[];
  } = {}): Promise<{ data: Record<string, unknown>[]; total?: number }> {
    const pageSize = Math.min(params.pageSize ?? 100, MAX_PAGE_SIZE);
    const allData: Record<string, unknown>[] = [];
    let data_id: string | undefined;
    let total: number | undefined;
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      console.error(`[翻页] 第 ${pages} 页...`);
      const res = await this.listData(appId, entryId, { data_id, limit: pageSize, filter: params.filter, fields: params.fields });
      allData.push(...res.data);
      if (total === undefined && res.total !== undefined) total = res.total;
      if (res.data.length < pageSize) break;
      const last = res.data[res.data.length - 1];
      data_id = (last as any)._id as string | undefined;
      if (!data_id) break;
      await sleep(200);
    }
    return { data: allData, total };
  }

  getData(appId: string, entryId: string, dataId: string): Promise<GetDataResponse> {
    return this.post('/v5/app/entry/data/get', {
      app_id: appId,
      entry_id: entryId,
      data_id: dataId,
    });
  }

  // === DATA WRITE ===
  createData(params: {
    app_id: string;
    entry_id: string;
    data: Record<string, unknown>;
    data_creator?: string;
    is_start_workflow?: boolean;
    is_start_trigger?: boolean;
    transaction_id?: string;
  }): Promise<CreateDataResponse> {
    return this.post('/v5/app/entry/data/create', params);
  }

  batchCreateData(params: {
    app_id: string;
    entry_id: string;
    data_list: Record<string, unknown>[];
    data_creator?: string;
    is_start_workflow?: boolean;
    transaction_id?: string;
  }): Promise<BatchCreateDataResponse> {
    return this.post('/v5/app/entry/data/batch_create', params);
  }

  updateData(params: {
    app_id: string;
    entry_id: string;
    data_id: string;
    data: Record<string, unknown>;
    is_start_trigger?: boolean;
    transaction_id?: string;
  }): Promise<UpdateDataResponse> {
    return this.post('/v5/app/entry/data/update', params);
  }

  batchUpdateData(params: {
    app_id: string;
    entry_id: string;
    data_ids: string[];
    data: Record<string, unknown>;
    transaction_id?: string;
  }): Promise<BatchUpdateDataResponse> {
    return this.post('/v5/app/entry/data/batch_update', params);
  }

  deleteData(params: {
    app_id: string;
    entry_id: string;
    data_id: string;
    is_start_trigger?: boolean;
  }): Promise<DeleteDataResponse> {
    return this.post('/v5/app/entry/data/delete', params);
  }

  batchDeleteData(params: {
    app_id: string;
    entry_id: string;
    data_ids: string[];
  }): Promise<BatchDeleteDataResponse> {
    return this.post('/v5/app/entry/data/batch_delete', params);
  }

  // === WORKFLOW ===
  getWorkflowInstance(instanceId: string, tasksType = 1): Promise<WorkflowInstanceResponse> {
    return this.post('/v6/workflow/instance/get', {
      instance_id: instanceId,
      tasks_type: tasksType,
    });
  }

  getWorkflowLogs(instanceId: string, types = ['comment'], skip = 0, limit = 100): Promise<WorkflowLogsResponse> {
    return this.post('/v1/workflow/instance/logs', {
      instance_id: instanceId,
      types,
      skip,
      limit,
    });
  }

  getApprovalComments(appId: string, entryId: string, dataId: string, skip = 0): Promise<ApprovalCommentsResponse> {
    return this.post(
      `/v1/app/${appId}/entry/${entryId}/data/${dataId}/approval_comments`,
      { skip },
    );
  }

  listMyTasks(username: string, params: {
    task_id?: string;
    limit?: number;
  } = {}): Promise<ListTasksResponse> {
    return this.post('/v6/workflow/task/list', {
      username,
      ...params,
    });
  }

  async listAllTasks(username: string, params: {
    pageSize?: number;
  } = {}): Promise<{ tasks: TaskItem[] }> {
    const pageSize = Math.min(params.pageSize ?? 100, MAX_PAGE_SIZE);
    const allTasks: TaskItem[] = [];
    let task_id: string | undefined;
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      console.error(`[翻页] 第 ${pages} 页...`);
      const res = await this.listMyTasks(username, { task_id, limit: pageSize });
      allTasks.push(...res.tasks);
      if (!res.has_more || res.tasks.length === 0) break;
      task_id = res.tasks[res.tasks.length - 1].task_id;
      await sleep(200);
    }
    return { tasks: allTasks };
  }

  // === WORKFLOW ACTIONS ===
  approveTask(params: {
    username: string;
    instance_id: string;
    task_id: string;
    comment?: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/task/approve', params);
  }

  rejectTask(params: {
    instance_id: string;
    task_id: string;
    username: string;
    comment?: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/task/reject', params);
  }

  rollbackTask(params: {
    username: string;
    instance_id: string;
    task_id: string;
    flow_id?: number;
    comment?: string;
    back_type?: number;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v2/workflow/task/rollback', params);
  }

  transferTask(params: {
    username: string;
    instance_id: string;
    task_id: string;
    transfer_username: string;
    comment?: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/task/transfer', params);
  }

  addSignTask(params: {
    instance_id: string;
    task_id: string;
    username: string;
    add_sign_type: number;
    add_sign_username: string;
    comment?: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/task/add_sign', params);
  }

  closeInstance(params: {
    instance_id: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/instance/close', params);
  }

  activateInstance(params: {
    instance_id: string;
    flow_id: number;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v1/workflow/instance/activate', params);
  }

  revokeTask(params: {
    instance_id: string;
    task_id?: string;
    username: string;
    comment?: string;
  }): Promise<WorkflowActionResponse> {
    return this.post('/v2/workflow/task/revoke', params);
  }

  // === ADDRESSBOOK ===
  getUserInfo(username: string): Promise<GetUserInfoResponse> {
    return this.post('/v5/corp/user/get', { username });
  }

  listDepartmentMembers(deptNo: number, hasChild = false): Promise<ListDeptMembersResponse> {
    return this.post('/v5/corp/department/user/list', {
      dept_no: deptNo,
      has_child: hasChild,
    });
  }

  listDepartments(deptNo: number, hasChild = false): Promise<ListDepartmentsResponse> {
    return this.post('/v6/corp/department/list', {
      dept_no: deptNo,
      has_child: hasChild,
    });
  }

  listRoles(skip = 0, limit = 100): Promise<ListRolesResponse> {
    return this.post('/v5/corp/role/list', { skip, limit });
  }

  listRoleUsers(roleNo: number, skip = 0, limit = 100): Promise<ListRoleUsersResponse> {
    return this.post('/v5/corp/role/user/list', { role_no: roleNo, skip, limit });
  }

  listRoleGroups(skip = 0, limit = 100): Promise<ListRoleGroupsResponse> {
    return this.post('/v5/corp/role_group/list', { skip, limit });
  }

  listGuestDepartments(deptNo?: number): Promise<GuestDeptListResponse> {
    return this.post('/v5/corp/guest/department/list', deptNo ? { dept_no: deptNo } : {});
  }

  listGuestUsers(deptNo?: number): Promise<ListGuestUsersResponse> {
    return this.post('/v5/corp/guest/user/list', deptNo ? { dept_no: deptNo } : {});
  }

  getGuestUser(username: string): Promise<GetGuestUserResponse> {
    return this.post('/v5/corp/guest/user/get', { username });
  }

  // === ROLE ===
  createRole(params: { name: string; group_no: number }): Promise<CreateRoleResponse> {
    return this.post('/v5/corp/role/create', params);
  }

  updateRole(params: { role_no: number; group_no: number; name?: string }): Promise<UpdateRoleResponse> {
    return this.post('/v5/corp/role/update', params);
  }

  deleteRole(role_no: number): Promise<DeleteRoleResponse> {
    return this.post('/v5/corp/role/delete', { role_no });
  }

  addRoleMembers(role_no: number, usernames: string[]): Promise<AddRoleMembersResponse> {
    return this.post('/v5/corp/role/add_members', { role_no, usernames });
  }

  removeRoleMembers(role_no: number, usernames: string[]): Promise<RemoveRoleMembersResponse> {
    return this.post('/v5/corp/role/remove_members', { role_no, usernames });
  }

  // === ROLE GROUP ===
  createRoleGroup(name: string): Promise<CreateRoleGroupResponse> {
    return this.post('/v5/corp/role_group/create', { name });
  }

  updateRoleGroup(role_group_no: number, name: string): Promise<UpdateRoleGroupResponse> {
    return this.post('/v5/corp/role_group/update', { role_group_no, name });
  }

  deleteRoleGroup(role_group_no: number): Promise<DeleteRoleGroupResponse> {
    return this.post('/v5/corp/role_group/delete', { role_group_no });
  }

  // === ADDRESSBOOK WRITE ===
  createUser(params: {
    name: string;
    username?: string;
    departments?: number[];
  }): Promise<CreateUserResponse> {
    return this.post('/v5/corp/user/create', params);
  }

  updateUser(params: {
    username: string;
    name?: string;
    departments?: number[];
  }): Promise<UpdateUserResponse> {
    return this.post('/v5/corp/user/update', params);
  }

  deleteUser(username: string): Promise<DeleteUserResponse> {
    return this.post('/v5/corp/user/delete', { username });
  }

  batchDeleteUsers(usernames: string[]): Promise<BatchDeleteUserResponse> {
    return this.post('/v5/corp/user/batch_delete', { usernames });
  }

  importUsers(users: { username: string; name: string; departments: number[] }[]): Promise<ImportUsersResponse> {
    return this.post('/v5/corp/user/import', { users });
  }

  createDepartment(params: {
    name: string;
    parent_no?: number;
    dept_no?: number;
  }): Promise<CreateDepartmentResponse> {
    return this.post('/v6/corp/department/create', params);
  }

  updateDepartment(params: {
    dept_no: number;
    name?: string;
    parent_no?: number;
    seq?: number;
  }): Promise<UpdateDepartmentResponse> {
    return this.post('/v6/corp/department/update', params);
  }

  deleteDepartment(dept_no: number): Promise<DeleteDepartmentResponse> {
    return this.post('/v5/corp/department/delete', { dept_no });
  }

  getDeptNoByIntegrateId(integrate_id: string): Promise<GetDeptNoResponse> {
    return this.post('/v6/corp/department/dept_no/get', { integrate_id });
  }

  importDepartments(departments: { dept_no: number; name: string; parent_no?: number }[]): Promise<ImportDepartmentsResponse> {
    return this.post('/v5/corp/department/import', { departments });
  }

  // === FILE ===
  getUploadToken(params: {
    app_id: string;
    entry_id: string;
    transaction_id: string;
  }): Promise<GetUploadTokenResponse> {
    return this.post('/v5/app/entry/file/get_upload_token', params);
  }

  async uploadFile(url: string, token: string, filePath: string): Promise<{ key: string }> {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > this.maxUploadSize) {
        throw new ApiError(400, `文件超过 ${this.maxUploadSize / 1024 / 1024}MB 限制`);
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, `文件不存在: ${filePath}`);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new ApiError(400, '无效的上传地址');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new ApiError(400, '上传地址必须使用 HTTPS');
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.startsWith('169.254.')) {
      throw new ApiError(400, `不允许上传到内网地址: ${hostname}`);
    }
    const form = new FormData();
    form.append('token', token);
    form.append('file', fs.createReadStream(filePath));
    const res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 60000, maxRedirects: 0 });
    return res.data;
  }

  // === WORKFLOW CC ===
  listCcList(username: string, params: { skip?: number; limit?: number; read_status?: string } = {}): Promise<WorkflowCcListResponse> {
    return this.post('/v1/workflow/cc/list', { username, skip: 0, limit: 10, ...params });
  }

  async listAllCcList(username: string, params: { pageSize?: number; read_status?: string } = {}): Promise<{ cc_list: CcItem[] }> {
    const pageSize = Math.min(params.pageSize ?? 100, MAX_PAGE_SIZE);
    const allItems: CcItem[] = [];
    let skip = 0;
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      console.error(`[翻页] 第 ${pages} 页...`);
      const res = await this.listCcList(username, { skip, limit: pageSize, read_status: params.read_status });
      allItems.push(...res.cc_list);
      if (!res.has_more || res.cc_list.length === 0) break;
      skip += pageSize;
      await sleep(200);
    }
    return { cc_list: allItems };
  }

  // === USAGE ===
  getUsageOverview(date?: string): Promise<CorpUsageOverviewResponse> {
    return this.post('/v1/corp_usage/overview', date ? { date } : {});
  }

  getUsageAppMetrics(params: { date?: string; app_ids?: string[]; skip?: number; limit?: number } = {}): Promise<CorpUsageAppMetricsResponse> {
    return this.post('/v1/corp_usage/app_metrics', { skip: 0, limit: 20, ...params });
  }

  getUsageMemberMetrics(params: { date?: string; member_ids?: string[]; skip?: number; limit?: number } = {}): Promise<CorpUsageMemberMetricsResponse> {
    return this.post('/v1/corp_usage/member_metrics', { skip: 0, limit: 20, ...params });
  }

  // === AUDIT LOG ===
  listAuditLogs(params: {
    domain: string;
    time_range: { start: string; end: string };
    event_types?: string[];
    limit?: number;
    cursor?: string;
    filters?: Record<string, unknown>;
  }): Promise<AuditLogListResponse> {
    return this.post('/v1/audit_log/list', params);
  }

  async listAllAuditLogs(params: {
    domain: string;
    time_range: { start: string; end: string };
    event_types?: string[];
    pageSize?: number;
    filters?: Record<string, unknown>;
  }): Promise<{ items: AuditLogItem[] }> {
    const pageSize = Math.min(params.pageSize ?? 200, MAX_PAGE_SIZE);
    const allItems: AuditLogItem[] = [];
    let cursor: string | undefined;
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      console.error(`[翻页] 第 ${pages} 页...`);
      const res = await this.listAuditLogs({ ...params, limit: pageSize, cursor });
      allItems.push(...res.items);
      if (!res.has_more || !res.cursor) break;
      cursor = res.cursor;
      await sleep(200);
    }
    return { items: allItems };
  }

  getAuditLogDomains(): Promise<AuditLogDomainsResponse> {
    return this.post('/v1/audit_log/domains', {});
  }
}
