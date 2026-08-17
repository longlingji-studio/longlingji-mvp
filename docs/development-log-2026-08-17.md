# 珑灵记开发日志：从仓库初始化到陪伴记忆 P1

## 文档用途

这份日志用于记录从 GitHub 仓库初始化到 2026-08-17 本阶段完成的工程操作、架构决策、测试结果和未完成边界。它是开发存档，不等同于产品 PRD，也不替代硬件规格书、隐私合规文件或量产认证计划。

## 项目基础

- 仓库：`longlingji-studio/longlingji-mvp`
- 主要分支：`main`
- 当前开发分支：`agent/companion-memory-p1`
- 工程形态：pnpm workspace + TypeScript monorepo
- 当前包：`packages/agent-core`、`services/agent-api`
- 当前年龄范围：`6_7`、`8_10`
- 当前主要场景：`spot_feedback`、`companion_reply`

## 阶段一：仓库和 Agent Core 初始化

### 已完成操作

1. 建立 GitHub Organization 下的私有仓库。
2. 设置 pnpm workspace，预留 `apps/`、`packages/`、`services/`。
3. 使用 TypeScript、Zod 和 Vitest。
4. 创建 `packages/agent-core`。
5. 固定请求、事实、证据、记忆候选、安全和模型输出 Schema。
6. 创建 Context Builder，只把审核事实和已验证证据交给模型。
7. 创建 ModelProvider 接口和 MockProvider。
8. 创建 `spot_feedback` Prompt 和太和门铜狮开发样例。
9. 加入儿童安全规则：走失、隐私输入、疲劳/停止。
10. 加入模型输出的证据引用、禁语、年龄字数和记忆证据检查。
11. 使用 Vitest 覆盖正常回应、错误引用、禁语、低置信 ASR、安全事件、媒体记忆和超时。

### 阶段结果

- 初始 Agent Core 测试通过。
- 提交：`7e8eae7 scaffold controlled agent core`
- 后续合并到 `main` 的提交：`887702d Merge pull request #1 from longlingji-studio/agent/agent-core-p0`

## 阶段二：严格错误和 HTTP 测试台

### 目标

将 Agent 从“可单元测试函数”推进到“可通过 HTTP 调用的开发链路”，同时不让模型错误伪装成正常回答。

### 已完成操作

1. 删除技术兜底结果和 `fallbackUsed/fallbackReason`。
2. 增加固定 `AgentError` 错误码。
3. 模型超时、Provider 报错、输出结构错误、引用错误和策略错误直接抛出。
4. 保留走失、隐私和主动停止的固定安全回应，因为它们是业务安全规则。
5. 创建 `services/agent-api`。
6. 增加健康检查、Spot 样例和 Spot Agent 路由。
7. 创建开发测试台，可以编辑请求 JSON 并查看原始响应。
8. 设置单次 Provider 调用、4 秒超时、128KB 请求体限制。
9. 增加 API 输入错误、模型错误和 Provider 错误测试。
10. 增加 ADR-002，记录严格错误策略。

### 阶段结果

- 提交：`c1d357f add strict agent api console`
- 分支：`agent/strict-agent-api-console`
- 已推送到远端，`main` 未被本阶段直接修改。
- 当时验证：Agent Core 9 个测试、API 6 个测试、类型检查和构建全部通过。

## 阶段三：陪伴对话、记忆和具身协议 P1

### 参考输入

本阶段参考内部文件《芙崽Fuzozo AI硬件技术拆解暨元珑实体AI伙伴技术路线建议》V1.0，证据截止 2026-08-13。该文件的工程建议被拆成“本阶段可以落地的云端契约”和“硬件/供应商后续工作”两部分。

### 已完成操作

1. 新增 `companion_reply` 场景。
2. 新增陪伴对话请求、模型输出和最终响应 Schema。
3. 新增 `grounded / unknown / not_needed` 知识状态。
4. 新增陪伴 Prompt，明确“没有依据就说不知道”。
5. 新增 active memory 引用策略，禁止没有记忆引用却说“我记得你”。
6. 新增家庭、儿童档案和角色实例三层记忆隔离。
7. 新增五类记忆：event、semantic、relationship、growth、reflection。
8. 新增来源、置信度、敏感级别、监护人可见级别、保留期和状态字段。
9. 新增 Memory Admission Gate。
10. 只有当前回合已验证的 choice/transcript 才可以申请写入记忆。
11. 推断记忆、媒体-only 记忆、低置信度记忆和敏感记忆不进入普通存储。
12. 新增开发用 `InMemoryMemoryStore`，支持范围召回和软删除。
13. 新增人格六层状态快照和 P2 特质变化裁决。
14. 增加单次、每日、每周特质变化幅度限制。
15. 新增固定具身表达枚举，模型不能输出任意硬件代码。
16. 新增陪伴对话 HTTP 路由和可切换开发测试台场景。
17. 增加陪伴、记忆、人格和安全测试。
18. 新增 `docs/architecture/companion-memory-p1.md`。
19. 新增显式配置的 OpenAI-compatible Provider 适配器：只发送一次请求，严格检查 HTTP、响应结构和 JSON 内容，不注入密钥、不读取隐式环境变量、不自动重试。
20. 新增 `Zone → Landmark → Spot → Quest` 目录 Schema、父子关系校验、开发样例和只读 Journey API。
21. 将记忆召回移动到服务端运行链路：模型上下文先按当前身份和输入召回，客户端不能再通过请求体提交 `memories` 快照。
22. 为客户端伪造记忆、Journey 父子关系和发布状态增加测试。
23. 新增 Quest progress 状态机：`start → in_progress → submit → completed`，并通过 HTTP 暴露提交接口。

### 本阶段固定字符串

```text
scene = companion_reply
promptVersion = yuanlong.companion-reply.v1
GET  /api/v1/development/companion-reply-fixture
POST /api/v1/agent/companion-reply
knowledgeStatus = grounded | unknown | not_needed
memoryDecision = not_requested | accepted | rejected
GET  /api/v1/development/journey-catalog
GET  /api/v1/journey/zones
GET  /api/v1/journey/landmarks?zoneId=...
GET  /api/v1/journey/spots?landmarkId=...
GET  /api/v1/journey/quests?spotId=...
POST /api/v1/journey/quest-progress
```

### 本阶段验证目标

- 模型可以基于审核事实回答。
- 没有事实时可以明确说不知道。
- 没有 active memory 时不能声称记得孩子过去说过的话。
- 记忆写入必须引用当前验证证据。
- 记忆必须绑定 household、child profile 和 character instance。
- 删除后的记忆不能再次召回。
- 人格变化不能超过规则限制。
- 具身输出只允许固定枚举。

## 当前测试和构建

运行命令：

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

当前阶段测试构成：

- Agent Core：Spot 测试 9 个。
- Agent Core：陪伴测试 6 个。
- Agent Core：记忆测试 5 个。
- Agent Core：人格策略测试 4 个。
- Agent Core：OpenAI-compatible Provider 测试 3 个。
- Agent Core：Journey 目录测试 4 个。
- Agent Core：Quest progress 测试 5 个。
- API：9 个。
- 合计：45 个自动化测试。

## 当前明确没有完成

### 模型与语音

- 真实阿里百炼/通义 Provider。
- 流式 ASR、TTS、AEC、NS、VAD。
- 主备语音供应商。
- 全双工打断和 `≤350ms` 打断指标。

### 记忆和后端

- CloudBase/MySQL/PostgreSQL 持久化。
- Embedding、向量库和生产 RAG。
- 异步反思 Worker。
- 监护人查看、纠正、导出和删除的正式 API。
- 多账户和儿童档案正式权限系统。

### 硬件

- BK7258/R1 或 ESP32-S3 固件。
- 双麦声学、屏幕、触摸、IMU、震动、OTA。
- 真实设备协议和音频流网关。
- 硬件认证、电池、温升、跌落和量产测试。

### 产品

- 正式 App UI/UX。
- Journey、Recommendation、Quest 状态机的产品完整体验和持久化实现。
- Spot 批量内容后台。
- 真实儿童家庭测试。

### 本阶段新增但仍是开发实现

- Journey 目录目前是 `InMemoryJourneyCatalogStore`，只有只读 API，没有正式运营后台、权限和数据库写入。
- Memory 目前是 `InMemoryMemoryStore`，服务端召回边界已固定，但还没有 CloudBase/MySQL 持久化。
- OpenAI-compatible Provider 只有适配器和测试，未配置真实供应商密钥，也未声称已经接入阿里百炼/通义。

## 下一步建议

1. 评审本阶段 `companion_reply` 输入输出契约。
2. 确定真实模型 Provider 和公司账户权限。
3. 接入真实模型前，准备至少 20 条正常对话、10 条“应该说不知道”对话和 20 条安全测试样例。
4. 将 `InMemoryMemoryStore` 替换为正式持久化适配器前，先确认数据库字段和监护人数据权利。
5. 单独建设 ASR/TTS Adapter，不把供应商 SDK 写进 Agent Core。
6. 设备协议沿用固定的 embodiment 枚举，禁止模型直接控制硬件。

## 存档原则

- 所有模型输出必须可追踪到 Prompt、模型版本、事实 ID、记忆 ID 和请求 ID。
- 任何记忆错误都必须可以定位来源、撤销和删除。
- 任何未完成能力都不通过 Mock 结果伪装成生产能力。
- 产品、人格和安全决策冻结后，再进入真实 Provider 和设备联调。
