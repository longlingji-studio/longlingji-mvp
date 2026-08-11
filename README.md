# 珑灵记 MVP

本仓库承载珑灵记 App、服务端和共享领域能力。第一阶段只实现可审计的元珑 Agent P0 核心，不接产品 UI、云服务或真实模型密钥。

## 当前范围

- `spot_feedback`：根据本次可追溯证据生成短回应。
- 模型只拥有表达权；Spot 推荐、到达、奖励和 Journey 状态由确定性后端规则负责。
- 当前使用 `MockProvider`。阿里百炼／通义将通过同一个 `ModelProvider` 接口接入。
- 太和门铜狮数据仅为 `development_only` 测试样例，不代表已发布内容。

## 工作区

```text
packages/agent-core/   元珑 Agent 的契约、策略、Provider 接口和测试
docs/decisions/        可追踪的架构决策
apps/                  后续 uni-app 客户端
services/              后续 CloudBase 服务层
```

## 本地验证

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

任何 `.env`、模型 Key、儿童原始媒体和生产内容都不得提交到 Git。
