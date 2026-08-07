# ADR-001：元珑 Agent P0 采用受控、类型化流水线

- 状态：已确认
- 日期：2026-08-07
- 决策人：项目总工程师

## 背景

元珑需要基于儿童本次真实提交和已审核文化内容进行回应。MVP 不承诺开放聊天、模型自主选点、模型发放奖励或模型直接写入长期记忆。

## 决策

1. 使用 pnpm、TypeScript、Vitest 和 Zod。
2. Agent Core 独立于前端、CloudBase 和具体模型供应商。
3. 所有模型输入先经过字段白名单和儿童安全策略。
4. 所有模型输出必须通过 JSON Schema、引用和禁语校验。
5. 模型异常、超时或违反策略时使用确定性模板兜底。
6. P0 允许生成 `memoryCandidate`，但 Agent Core 不执行持久化。
7. 首个实现为 `spot_feedback`；随后依次实现 `recommendation_copy` 和 `journey_diary`。

## 明确不做

- 不使用 LangChain、LangGraph 或 ReAct 循环。
- 不开放工具调用、数据库写入或地图调用。
- 不把未验证照片内容或低置信 ASR 当成儿童事实。
- 不使用 Embedding、向量数据库或 RAG；P0 通过稳定 ID 精确获取内容快照。

## 结果

每次生成均可复现、可测试、可回退。后续模型供应商变化不会改变上层业务契约。
