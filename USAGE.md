# jiandaoyun-cli 使用说明

## 目录

- [认证](#认证)
- [全局选项](#全局选项)
- [应用管理](#应用管理)
- [数据管理](#数据管理)
- [文件上传](#文件上传)
- [流程管理](#流程管理)
- [通讯录](#通讯录)
- [资源用量](#资源用量)
- [审计日志](#审计日志)
- [配置管理](#配置管理)
- [常见问题](#常见问题)

---

## 认证

API Key 从简道云后台获取：**企业管理 → 开放平台 → 开启 API**

三种方式（优先级从高到低）：

1. **命令行参数**：`jdy --api-key <key> <command>`
2. **环境变量**：`set JDY_API_KEY=<key>`（Windows）或 `export JDY_API_KEY=<key>`（Linux/Mac）
3. **持久化配置**：`jdy config set apiKey <key>`

配置存储在 `~/.jiandaoyun-cli/config.json`（仅当前用户可读写），不会提交到代码仓库。

---

## 全局选项

| 选项 | 说明 |
|------|------|
| `--api-key <key>` | 指定 API Key |
| `--json` | JSON 格式输出（便于程序解析） |
| `-V, --version` | 查看版本 |
| `-h, --help` | 查看帮助 |

`--json` 可在任何命令前使用，输出原始 API 返回数据。示例：

```bash
jdy --json app list
jdy --json data list <appId> <entryId>
```

---

## 应用管理

```bash
jdy app list                            # 列出所有应用
jdy app form-list <appId>               # 列出应用下的表单
jdy app form-get <appId> <entryId>      # 查询表单详情（名称/描述等）
jdy app form-widgets <appId> <entryId>  # 查询表单字段列表（用于构造数据）
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `appId` | 应用 ID，从 `app list` 获取 |
| `entryId` | 表单 ID，从 `form-list` 获取 |

`form-widgets` 返回字段的 `widgetName` 是数据的字段 key（如 `_widget_xxxxxxxxx`），`label` 是中文名称。

---

## 数据管理

### 查询数据

```bash
# 查询多条（默认最新 100 条）
jdy data list <appId> <entryId>

# 指定数量
jdy data list <appId> <entryId> --limit 10

# 条件过滤
jdy data list <appId> <entryId> --filter '{"字段名":{"$eq":"值"}}'

# 只查指定字段
jdy data list <appId> <entryId> --fields "field1,field2"

# 自动翻页（获取全部数据）
jdy data list <appId> <entryId> --all

# 翻页时自定义每页大小
jdy data list <appId> <entryId> --all --page-size 500

# 查询单条
jdy data get <appId> <entryId> <dataId>
```

`--filter` 支持的运算符见简道云 API 文档：`$eq`（等于）、`$ne`（不等于）、`$gt`（大于）、`$lt`（小于）、`$in`（包含于）、`$and`（与）、`$or`（或）等。

### 写入数据

**数据格式说明：**

所有数据字段使用 `{"_widget_xxx": {"value": 实际值}}` 格式：

```bash
# 新建单条
jdy data create <appId> <entryId> --data '{"_widget_xxx":{"value":"文本值"},"_widget_yyy":{"value":123}}'

# 从文件读取（适合大量数据）
jdy data create <appId> <entryId> --file data.json

# 修改单条（只需传要修改的字段）
jdy data update <appId> <entryId> <dataId> --data '{"_widget_xxx":{"value":"新值"}}'

# 删除单条
jdy data delete <appId> <entryId> <dataId>

# 批量新建
jdy data batch-create <appId> <entryId> --file data.json

# 批量修改（统一改为相同值）
jdy data batch-update <appId> <entryId> --ids "id1,id2" --data '{"_widget_xxx":{"value":"新值"}}'

# 批量删除
jdy data batch-delete <appId> <entryId> --ids "id1,id2"
```

**常用字段类型：**

| 字段类型 | value 格式 | 示例 |
|---------|-----------|------|
| 单行文本 | `"string"` | `{"value":"张三"}` |
| 数字 | `number` | `{"value":100}` |
| 日期时间 | `"ISO 8601"` | `{"value":"2026-06-01T00:00:00.000Z"}` |
| 成员 | `"username"` | `{"value":"u_xxxxxxxxx"}` |
| 部门 | `dept_no` | `{"value":123456789}` |
| 下拉单选 | `"选项文本"` | `{"value":"同意"}` |
| 子表单 | `[{...}]` | `{"value":[{"_widget_sub1":{"value":"a"}}]}` |
| 关联数据 | `{"data_id":"..."}` | `{"value":{"data_id":"xxxxxxxxxxxx..."}}` |

**写入选项：**

| 选项 | 说明 |
|------|------|
| `--dry-run` | 预览数据，不真正提交 |
| `--yes` | 跳过确认提示 |
| `--creator <username>` | 指定数据提交人 |
| `--start-workflow` | 新建数据后自动发起流程 |
| `--start-trigger` | 触发智能助手 |

**发起流程示例：**

```bash
jdy data create <appId> <entryId> --data '{"_widget_xxx":{"value":"..."}}' --start-workflow --creator <username>
```

流程发起后可通过 `workflow task-list` 查看待办任务。

---

## 文件上传

上传文件到表单的附件/图片字段。

```bash
# 先获取上传凭证（返回 token 和上传地址）
jdy file get-upload-token <appId> <entryId>

# 上传文件（自动获取凭证并上传）
jdy file upload <appId> <entryId> ./document.pdf
```

上传成功后返回 `key`（文件标识），将 key 填入数据 create/update 的附件字段：

```json
{"_widget_file":{"value":"返回的key"}}
```

---

## 流程管理

### 查询流程

```bash
# 查询流程实例详情（含节点状态）
jdy workflow instance-get <instanceId>

# 查询流程日志（审批意见等）
jdy workflow log <instanceId> --types comment

# 查询审批意见
jdy workflow comments <appId> <entryId> <dataId>

# 查询待办任务
jdy workflow task-list --username <user>
jdy workflow task-list --username <user> --all    # 全部待办

# 查询抄送列表
jdy workflow cc-list --username <user>
jdy workflow cc-list --username <user> --all      # 全部抄送

# 抄送按已读/未读筛选
jdy workflow cc-list --username <user> --read-status unread
```

### 流程任务操作

所有任务操作支持以下通用选项：

| 选项 | 说明 |
|------|------|
| `-u, --username <user>` | 操作人（默认 `$JDY_USERNAME`） |
| `-c, --comment <text>` | 操作意见/备注 |
| `-i, --instance <id>` | 流程实例 ID（同数据 ID） |
| `--dry-run` | 预览，不真正执行 |
| `--yes` | 跳过确认 |

**常用操作：**

```bash
# 审批通过
jdy workflow task approve <taskId> -i <instanceId> -u <username> -c "同意"

# 否决
jdy workflow task reject <taskId> -i <instanceId> -u <username> -c "不同意"

# 回退
jdy workflow task back <taskId> -i <instanceId> -u <username> -c "请修改"
jdy workflow task back <taskId> -i <instanceId> -n <flowId>    # 回退到指定节点
jdy workflow task back <taskId> -i <instanceId> --back-type direct  # 直达目标节点

# 转交
jdy workflow task transfer <taskId> -i <instanceId> --to <targetUser> -c "请处理"

# 加签
jdy workflow task add-sign <taskId> -i <instanceId> --add-user <user> --add-type before
# add-type: before（前加签）, after（后加签）, parallel（并加签）

# 撤回待办
jdy workflow task recall <taskId> -i <instanceId>
jdy workflow task recall <taskId> -i <instanceId> --source-task <taskId>  # 撤回发起节点

# 提交（同 approve）
jdy workflow task submit <taskId> -i <instanceId> -c "提交"
jdy workflow task submit-and-print <taskId> -i <instanceId>

# 暂存（保存表单数据，不流转）
jdy workflow task save -i <instanceId> --app-id <appId> --entry-id <entryId> --data 'json'
jdy workflow task save-and-print -i <instanceId> --app-id <appId> --entry-id <entryId> --data 'json'
```

**注意：** 如果审批节点要求必填审批结果字段（如下拉框），需要在 approve 前先用 `data update` 填写：

```bash
# 1. 填写审批结果
jdy data update <appId> <entryId> <dataId> --data '{"_widget_审批结果":{"value":"同意"}}'

# 2. 提交审批
jdy workflow task approve <taskId> -i <instanceId> -u <username> -c "同意" --yes
```

### 流程实例操作

```bash
# 结束流程实例（管理员）
jdy workflow instance close <instanceId>

# 激活流程实例（管理员）
jdy workflow instance activate <instanceId> -n <flowId>
```

`flowId` 从 `instance-get` 或 `task-list` 获取，表示要激活到哪个节点。

---

## 通讯录

### 只读查询

```bash
# 成员
jdy addressbook user-get <username>              # 成员详情
jdy addressbook user-list [deptNo]               # 部门下的成员
jdy addressbook user-list [deptNo] --all         # 递归所有子部门

# 部门
jdy addressbook dept-list [deptNo]               # 部门列表
jdy addressbook dept-list --tree                 # 树形结构（含成员）

# 角色
jdy addressbook role-list                        # 所有角色
jdy addressbook role-user-list --role-no <no>    # 角色下的成员

# 角色组
jdy addressbook role-group-list                  # 所有角色组

# 互联企业
jdy addressbook guest-dept-list [deptNo]         # 互联企业部门
jdy addressbook guest-user-list [deptNo]         # 外部对接人列表
jdy addressbook guest-user-get <username>        # 外部对接人详情
```

### 写入操作

> **注意：** 与钉钉/企业微信/飞书集成的企业，通讯录由第三方同步，API 写入可能被禁用。

**成员管理：**

```bash
# 创建成员
jdy addressbook user-create "张三" -u "zhangsan" -d "1,2"

# 修改成员
jdy addressbook user-update "zhangsan" -n "张三丰" -d "1,3"

# 删除（标记为离职）
jdy addressbook user-delete "zhangsan" --yes

# 批量删除
jdy addressbook batch-delete-users "u1,u2,u3" --yes

# 增量导入（upsert）
jdy addressbook user-import '[{"username":"u1","name":"张三","departments":[1]}]'
jdy addressbook user-import '@data.json'
```

**部门管理：**

```bash
# 创建部门
jdy addressbook dept-create "研发部" -p 1
jdy addressbook dept-create "研发部" -p 1 -d 101

# 修改部门
jdy addressbook dept-update 101 -n "技术研发部" -p 1

# 删除部门
jdy addressbook dept-delete 101 --yes

# 获取集成模式部门编号
jdy addressbook dept-no-get <integrateId>

# 全量导入（覆盖部门树）
jdy addressbook dept-import '[{"dept_no":1,"name":"总公司"},{"dept_no":2,"name":"研发部","parent_no":1}]'
jdy addressbook dept-import '@data.json'
```

**角色管理：**

```bash
# 创建角色
jdy addressbook role-create "项目经理" -g <groupNo>

# 更新角色
jdy addressbook role-update <roleNo> -g <groupNo> -n "高级项目经理"

# 删除角色
jdy addressbook role-delete <roleNo> --yes

# 角色批量添加成员
jdy addressbook role-add-members <roleNo> -u "u1,u2"

# 角色批量移除成员
jdy addressbook role-remove-members <roleNo> -u "u1,u2"
```

**角色组管理：**

```bash
# 创建角色组
jdy addressbook role-group-create "技术序列"

# 更新角色组
jdy addressbook role-group-update <groupNo> "技术研发序列"

# 删除角色组
jdy addressbook role-group-delete <groupNo> --yes
```

---

## 资源用量

> 需要超管权限，未购买该功能时返回 403。

```bash
# 平台用量统计（默认前一天）
jdy usage overview
jdy usage overview --date 2026-06-01

# 应用用量（最多10个应用）
jdy usage app-metrics
jdy usage app-metrics --date 2026-06-01 --app-ids "id1,id2"

# 成员用量
jdy usage member-metrics
jdy usage member-metrics --date 2026-06-01
```

---

## 审计日志

> 需要超管权限，未开启审计日志功能时返回 403。

```bash
# 查询日志类型定义
jdy audit-log domains

# 查询日志明细
jdy audit-log list --domain login --start "2026-06-01T00:00:00Z" --end "2026-06-02T00:00:00Z"

# 指定事件类型
jdy audit-log list --domain app_builder --start "..." --end "..." --event-types "app_create,app_delete"

# 指定操作人
jdy audit-log list --domain platform --start "..." --end "..." --actor-ids "user1,user2"

# 自动翻页
jdy audit-log list --domain login --start "..." --end "..." --all
```

---

## 配置管理

```bash
# 设置配置
jdy config set apiKey eyJ...     # 持久化 API Key

# 查看所有配置
jdy config get

# 查看指定配置
jdy config get apiKey
```

配置文件存储在 `~/.jiandaoyun-cli/config.json`。

---

## 常见问题

### 如何找到 appId 和 entryId？

```bash
jdy app list              # 查看所有应用 → 得到 appId
jdy app form-list <appId> # 查看应用下的表单 → 得到 entryId
```

### 如何找到字段的 widgetName？

```bash
jdy app form-widgets <appId> <entryId>
```

输出中的 `widgetName` 是字段 key（如 `_widget_xxxxxxxxx`），`label` 是中文名称。

### 如何找到流程的 instanceId？

流程实例 ID 就是数据 ID。当使用 `--start-workflow` 创建数据时，返回的 `dataId` 就是 `instanceId`。也可通过 `task-list` 查询待办中的 `instance_id`。

### 如何找到 taskId？

```bash
jdy workflow task-list --username <user>
```

输出中的 `task_id` 字段。

### 批量操作的文件格式？

JSON 数组或包含数组的对象：

```json
[
  {"_widget_xxx": {"value": "数据1"}},
  {"_widget_xxx": {"value": "数据2"}}
]
```

### 写操作报 "Do not have permission"？

- 通讯录写入 → 钉钉集成模式下不可用
- 资源用量/审计日志 → 需要超管权限
- 其他 → 检查 API Key 的权限范围
