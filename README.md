# 珑灵记 MVP

本仓库承载珑灵记 App、服务端和共享领域能力。当前已实现可审计的元珑 Agent P0 核心、陪伴对话与记忆策略、严格 HTTP API 和内部开发测试台，不接正式产品 UI、云服务或真实模型密钥。

## 当前范围

- `spot_feedback`：根据本次可追溯证据生成短回应。
- `companion_reply`：面向陪伴式对话，允许基于审核事实和已授权记忆回应；没有依据时明确说不知道。
- `Zone → Landmark → Spot → Quest`：确定性 Journey 内容目录，发布列表只返回 `approved` 节点，并校验父子关系。
- 模型只拥有表达权；Spot 推荐、到达、奖励和 Journey 状态由确定性后端规则负责。
- 当前使用 `MockProvider`。阿里百炼／通义将通过同一个 `ModelProvider` 接口接入。
- 模型异常、超时、结构错误和策略错误直接返回显式错误，不重试、不替换成正常回应。
- 走失、隐私输入和孩子主动停止属于儿童安全业务规则，仍返回确定性安全回应。
- 记忆候选必须有当前回合的已验证证据；推断记忆、敏感记忆和媒体-only记忆不会进入普通记忆库。
- 陪伴请求不接受客户端记忆快照；服务端按家庭、儿童档案、角色实例和当前输入从 `MemoryStore` 召回。
- 人格变化必须经过证据数量、置信度和日/周幅度闸门；模型不能直接改写 P0/P1 人格。
- 具身输出只能使用固定的状态、情绪、触觉和音效枚举，模型不能输出任意硬件代码。
- 太和门铜狮数据仅为 `development_only` 测试样例，不代表已发布内容。

## 工作区

```text
packages/agent-core/   元珑 Agent 的契约、策略、Provider 接口和测试
services/agent-api/    严格 HTTP API 和内部开发测试台
docs/decisions/        可追踪的架构决策
docs/architecture/     Agent、记忆、人格和硬件表达边界
docs/development-log-2026-08-17.md  从仓库初始化到当前阶段的开发日志
apps/                  后续 uni-app 客户端
```

## 启动内部测试台

```bash
pnpm install
pnpm dev:agent-api
```

打开 `http://127.0.0.1:8787`。测试台只用于后端联调，不是产品 UI。

测试台可以切换 `Spot 回应` 和 `陪伴对话` 两个开发场景。

Journey 目录开发接口：

```text
GET /api/v1/development/journey-catalog
GET /api/v1/journey/zones
GET /api/v1/journey/landmarks?zoneId=...
GET /api/v1/journey/spots?landmarkId=...
GET /api/v1/journey/quests?spotId=...
POST /api/v1/journey/quest-progress
```

Quest progress accepts `quest-request.v1` commands: `start` creates an
`in_progress` record; `submit` requires verified evidence and changes it to
`completed`. Repeated starts and completion before start are explicit errors.

## 本地验证

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

任何 `.env`、模型 Key、儿童原始媒体和生产内容都不得提交到 Git。
