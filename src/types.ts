export interface AppInfo {
  name: string;
  app_id: string;
}

export interface ListAppsResponse {
  apps: AppInfo[];
}

export interface FormInfo {
  name: string;
  app_id: string;
  entry_id: string;
}

export interface ListFormsResponse {
  forms: FormInfo[];
}

export interface FormDetail {
  name: string;
  app_id: string;
  entry_id: string;
  description?: string;
  item_order?: number;
}

export interface GetFormResponse {
  form: FormDetail;
}

export interface FormWidget {
  name: string;
  widgetName: string;
  label: string;
  type: string;
  items?: FormWidget[];
  props?: Record<string, unknown>;
}

export interface ListWidgetsResponse {
  widgets: FormWidget[];
}

export interface ListDataResponse {
  data: Record<string, unknown>[];
  total?: number;
}

export interface GetDataResponse {
  data: Record<string, unknown>;
}

export interface CreateDataResponse {
  data: Record<string, unknown>;
}

export interface BatchCreateDataResponse {
  status: string;
  success_count: number;
  success_ids: string[];
}

export interface UpdateDataResponse {
  data: Record<string, unknown>;
}

export interface BatchUpdateDataResponse {
  status: string;
  success_count: number;
}

export interface DeleteDataResponse {
  status: string;
}

export interface BatchDeleteDataResponse {
  status: string;
  success_count: number;
}

export interface MemberEntity {
  _id?: string;
  username?: string;
  name?: string;
  departments?: number[];
  type?: number;
  status?: number;
  integrate_id?: string;
}

export interface WorkflowTask {
  app_id: string;
  form_id: string;
  form_title: string;
  title: string;
  instance_id: string;
  task_id: string;
  flow_id: number;
  flow_name: string;
  url: string;
  assignee: MemberEntity;
  creator: MemberEntity;
  create_time: string;
  create_action: string;
  finish_time: string | null;
  finish_action: string | null;
  status: number;
}

export interface WorkflowInstanceResponse {
  app_id: string;
  form_id: string;
  form_title: string;
  instance_id: string;
  url: string;
  update_time: string;
  create_time: string;
  finish_time: string | null;
  status: number;
  result?: number;
  creator: MemberEntity;
  tasks: WorkflowTask[];
}

export interface WorkflowLog {
  flow_id: number;
  flow_name: string;
  create_action: string;
  create_time: string;
  finish_action: string;
  finish_time: string;
  comment: string;
  signature?: { url: string };
  attachments?: { name: string; size: number; mime: string; url: string }[];
  operator: MemberEntity;
}

export interface WorkflowLogsResponse {
  logs: WorkflowLog[];
}

export interface ApprovalComment {
  flowNodeName: string;
  flowAction: string;
  comment: string;
  signature_url?: string;
  operator: MemberEntity;
}

export interface ApprovalCommentsResponse {
  approveCommentList: ApprovalComment[];
}

export interface TaskItem {
  app_id: string;
  form_id: string;
  task_id: string;
  instance_id: string;
  form_title: string;
  title: string;
  flow_id: number;
  flow_name: string;
  url: string;
  assignee: MemberEntity;
  creator: MemberEntity;
  create_time: string;
  create_action: string;
  finish_time: string | null;
  finish_action: string | null;
  status: number;
}

export interface ListTasksResponse {
  has_more: boolean;
  tasks: TaskItem[];
}

export interface DeptMember {
  username: string;
  name: string;
  departments: number[];
  type: number;
  status: number;
  integrate_id?: string;
}

export interface GetUserInfoResponse {
  user: DeptMember;
}

export interface ListDeptMembersResponse {
  users: DeptMember[];
}

export interface DeptInfo {
  dept_no: number;
  name: string;
  parent_no: number;
  type: number;
  status: number;
  seq?: number;
  integrate_id?: string;
}

export interface ListDepartmentsResponse {
  departments: DeptInfo[];
}

export interface RoleInfo {
  role_no: number;
  group_no: number;
  name: string;
  type: number;
  status: number;
  integrate_id?: string;
}

export interface ListRolesResponse {
  roles: RoleInfo[];
}

export interface ListRoleUsersResponse {
  users: DeptMember[];
}

export interface RoleGroupInfo {
  group_no: number;
  name: string;
  type: number;
  status: number;
  integrate_id?: string;
}

export interface ListRoleGroupsResponse {
  role_groups: RoleGroupInfo[];
}

export interface GuestDeptInfo {
  dept_no: number;
  name: string;
  type: number;
  status: number;
  integrate_id?: string;
}

export interface GuestDeptListResponse {
  dept_list: GuestDeptInfo[];
}

export interface CcItem {
  app_id: string;
  form_id: string;
  task_id: string;
  instance_id: string;
  form_title: string;
  title: string;
  flow_id: number;
  flow_name: string;
  url: string;
  assignee: MemberEntity;
  creator: MemberEntity;
  create_time: string;
  status: number;
  start_time: string;
  finish_time: string | null;
  start_action: string;
}

export interface WorkflowCcListResponse {
  has_more: boolean;
  cc_list: CcItem[];
}

export interface UsageMetrics {
  app: number;
  form_coop: number;
  form_workflow: number;
  dash: number;
  etl: number;
  aggregate: number;
  public_link: number;
  data_trigger: number;
  automation: number;
  bpa: number;
  data: number;
}

export interface CorpUsageOverviewResponse {
  date: string;
  metrics: UsageMetrics;
}

export interface UsageAppItem {
  app_id: string;
  app_name: string;
  creator: { member_id?: string; name?: string };
  created_at: string;
  last_edit_at: string;
  last_visit_at: string;
  metrics: UsageMetrics;
}

export interface CorpUsageAppMetricsResponse {
  date: string;
  has_next: boolean;
  items: UsageAppItem[];
}

export interface UsageMemberItem {
  member: { member_id: string; name: string };
  metrics: UsageMetrics;
}

export interface CorpUsageMemberMetricsResponse {
  date: string;
  has_next: boolean;
  items: UsageMemberItem[];
}

export interface AuditLogItem {
  event_id: string;
  event_time: string;
  event_type: string;
  domain: string;
  tenant: { id: string };
  actor: { type: string; id: string; name: string; ip: string; user_agent: string; geo: unknown };
  event: { category: string; action: string; outcome: string; severity: string };
  resource: { type: string; id: string; name: string; parent_id: string; parent_type: string };
  detail: Record<string, unknown>;
}

export interface AuditLogListResponse {
  has_more: boolean;
  cursor?: string;
  items: AuditLogItem[];
}

export interface AuditLogDomain {
  domain: string;
  event_types: string[];
}

export interface AuditLogDomainsResponse {
  domains: AuditLogDomain[];
}

export interface WorkflowActionResponse {
  status: string;
  code?: number;
  message?: string;
}

export interface CreateUserResponse {
  user: DeptMember;
}

export interface UpdateUserResponse {
  user: DeptMember;
}

export interface DeleteUserResponse {
  status: string;
}

export interface BatchDeleteUserResponse {
  status: string;
}

export interface CreateDepartmentResponse {
  department: DeptInfo;
}

export interface UpdateDepartmentResponse {
  department: DeptInfo;
}

export interface DeleteDepartmentResponse {
  status: string;
}

export interface UploadTokenItem {
  url: string;
  token: string;
}

export interface GetUploadTokenResponse {
  token_and_url_list: UploadTokenItem[];
}

export interface GuestUserInfo {
  name: string;
  username: string;
  departments: number[];
  type: number;
  status: number;
  integrate_id?: string;
}

export interface ListGuestUsersResponse {
  member_list: GuestUserInfo[];
}

export interface GetGuestUserResponse {
  member: GuestUserInfo;
}

export interface ImportUsersResponse {
  status: string;
}

export interface GetDeptNoResponse {
  department: DeptInfo;
}

export interface ImportDepartmentsResponse {
  status: string;
}

export interface CreateRoleResponse {
  role: RoleInfo;
}

export interface UpdateRoleResponse {
  role: RoleInfo;
}

export interface DeleteRoleResponse {
  status: string;
}

export interface AddRoleMembersResponse {
  status: string;
}

export interface RemoveRoleMembersResponse {
  status: string;
}

export interface CreateRoleGroupResponse {
  role_group: RoleGroupInfo;
}

export interface UpdateRoleGroupResponse {
  role_group: RoleGroupInfo;
}

export interface DeleteRoleGroupResponse {
  status: string;
}