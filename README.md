# jdy-cli

简道云 API 命令行工具。通过终端管理应用数据、审批流程、通讯录、文件等。

## 安装

```bash
npm install -g .
# 或开发模式
npx tsx src/index.ts
```

## 快速开始

```bash
# 1. 设置 API Key
jdy config set apiKey eyJ...     # 从简道云后台获取

# 2. 查看应用
jdy app list

# 3. 查询数据
jdy data list <appId> <entryId>

# 4. 查看帮助
jdy --help
```

## 认证方式

| 方式 | 命令 |
|------|------|
| 命令行参数 | `jdy --api-key <key> ...` |
| 环境变量 | `set JDY_API_KEY=<key>` |
| 持久化配置 | `jdy config set apiKey <key>` |

## 命令概览

| 分类 | 命令 | 说明 |
|------|------|------|
| 应用 | `jdy app list` | 查询所有应用 |
| 数据 | `jdy data list/get/create/update/delete` | 数据 CRUD |
| 流程 | `jdy workflow instance-get/task-list` | 查询流程 |
| 流程操作 | `jdy workflow task approve/reject/back/...` | 审批/退回/转交等 |
| 通讯录 | `jdy addressbook user-get/dept-list/...` | 成员/部门查询 |
| 通讯录写入 | `jdy addressbook user-create/dept-create/...` | 成员/部门管理 |
| 文件 | `jdy file upload` | 文件上传 |
| 配置 | `jdy config set/get` | 配置管理 |

详细用法见 [USAGE.md](./USAGE.md)。

## 开发

```bash
npm run build        # 编译
npm run dev          # 开发调试
npm run typecheck    # 类型检查
```

## 许可

MIT
