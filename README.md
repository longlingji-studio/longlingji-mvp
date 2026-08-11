# 珑灵记 MVP

本仓库承载珑灵记 App、服务端和共享领域能力。当前已实现可审计的元珑 Agent P0 核心、严格 HTTP API 和内部开发测试台，不接正式产品 UI、云服务或真实模型密钥。

## 当前范围

- `spot_feedback`：根据本次可追溯证据生成短回应。
- 模型只拥有表达权；Spot 推荐、到达、奖励和 Journey 状态由确定性后端规则负责。
- 当前使用 `MockProvider`。阿里百炼／通义将通过同一个 `ModelProvider` 接口接入。
- 模型异常、超时、结构错误和策略错误直接返回显式错误，不重试、不替换成正常回应。
- 走失、隐私输入和孩子主动停止属于儿童安全业务规则，仍返回确定性安全回应。
- 太和门铜狮数据仅为 `development_only` 测试样例，不代表已发布内容。

## 工作区

```text
packages/agent-core/   元珑 Agent 的契约、策略、Provider 接口和测试
services/agent-api/    严格 HTTP API 和内部开发测试台
docs/decisions/        可追踪的架构决策
apps/                  后续 uni-app 客户端
```

## 启动内部测试台

```bash
pnpm install
pnpm dev:agent-api
```

打开 `http://127.0.0.1:8787`。测试台只用于后端联调，不是产品 UI。

## 本地验证

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

任何 `.env`、模型 Key、儿童原始媒体和生产内容都不得提交到 Git。
