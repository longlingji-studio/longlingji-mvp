# 元珑陪伴对话、记忆与具身表达 P1

## 这次实现的目标

芙崽报告给出的关键判断是：陪伴感不是“模型什么都知道”，而是理解当下、符合角色、准确记得过去、在文本/声音/表情上保持一致。元珑本阶段先把后三个云端边界做成可测试的代码契约，暂不假装已经完成实体硬件和实时语音链路。

```mermaid
flowchart LR
    A["儿童文本或已验证转写"] --> B["companion_reply 请求校验"]
    B --> C["安全规则"]
    C -->|"走失/隐私/停止"| S["固定安全回应"]
    C -->|"普通输入"| D["Context Builder"]
    D --> E["审核事实 + 当前输入 + 服务端召回记忆 + 人格快照"]
    E --> F["一次 ModelProvider 调用"]
    F --> G["JSON Schema"]
    G --> H["知识引用/记忆引用/禁语/年龄策略"]
    H --> I["文本 + memoryProposal + embodiment"]
    I --> J["Memory Admission Gate"]
    J --> K["写入 MemoryStore 或明确拒绝"]
```

## 陪伴型对话和科普型对话的区别

`companion_reply` 不是开放式“什么都可以回答”的聊天机器人。模型有三种知识状态：

- `grounded`：使用至少一个审核事实，并返回 `knowledgeRefs`。
- `unknown`：上下文没有足够依据，明确表达不确定或不知道，`knowledgeRefs` 必须为空。
- `not_needed`：这轮是情绪回应、关系回应或安全回应，不需要文化事实。

同样，模型不能说“我记得你……”除非实际引用了当前作用域中的 active memory。没有记忆引用时，以下表达会被策略拒绝：

```text
我记得你
你以前说过
上次你
```

这条规则直接针对“鹅肝式虚假记忆”：模型不能把不存在的共同经历包装成关系连续性。

## 人格六层在当前代码中的边界

| 层级 | 当前处理方式 | 是否允许对话模型直接修改 |
|---|---|---|
| P0 世界观宪法 | 版本化配置，代码只读取 | 不允许 |
| P1 基线人格 | `baselineArchetype` 和 Prompt 配置 | 不允许 |
| P2 成长特质 | `personalityDeltaProposal`，由规则裁决 | 不允许直接写入 |
| P3 当前情绪 | `mood` 快照，作为本轮上下文 | 不直接持久化 |
| P4 关系状态 | `relationship` 快照 | 不允许模型直接改写 |
| P5 场景行为 | `scene` 快照，影响当前表达 | 只读 |

人格变化规则：

- 单次特质变化绝对值不超过 `0.005`。
- 每日累计绝对变化不超过 `0.02`。
- 每周累计绝对变化不超过 `0.06`。
- 至少需要两个不同事件 ID。
- 置信度低于 `0.75` 不自动接受。
- 任何敏感事件不能自动改变稳定人格。

## 记忆分层和来源

当前契约支持五类记忆：

```text
event
semantic
relationship
growth
reflection
```

每条记忆必须带：

```text
householdId
childProfileId
characterInstanceId
sourceEventIds
sourceType
confidence
privacyLevel
guardianVisibility
occurredAt
retentionUntil
status
```

来源类型：

```text
user_stated
observed
inferred
guardian_provided
```

本阶段的 Memory Admission Gate 规则：

1. 必须引用当前请求中的证据 ID。
2. 证据必须是已验证的 `choice` 或 `verified_transcript`。
3. `verified_transcript` 置信度必须达到 `0.85`。
4. 图片或音频上传本身不能形成记忆。
5. `inferred` 候选不自动写入。
6. 置信度低于 `0.85` 不写入。
7. `sensitive` 和 `highly_sensitive` 进入拒绝/人工审核路径，不进入普通记忆库。
8. 记忆必须绑定家庭、儿童档案和角色实例，禁止跨档案召回。
9. 删除是软删除，状态变为 `deleted` 后不能再召回。

当前 `InMemoryMemoryStore` 是开发实现，不是生产数据库。它用于验证隔离、召回和删除逻辑，后续可以替换成 CloudBase/MySQL 或其他持久化适配器。陪伴请求本身不再接收 `memories` 字段，避免客户端伪造记忆；运行时先用当前输入调用 `MemoryStore.recall`，再把召回结果交给模型。

## 召回策略

当前不使用 Embedding、向量库或 RAG 服务，而是做小规模、可解释的关键词召回：

- 先按 `householdId + childProfileId + characterInstanceId` 硬过滤。
- 只召回 `active` 记录。
- 排除 `highly_sensitive`。
- 使用简单中文二元词片段和文本片段匹配。
- 按匹配分数、时间倒序排序。
- 单次最多召回 8 条。

请求体只携带当前输入、身份作用域、审核事实和人格快照。身份作用域下的记忆由服务端持有，不能由 App 直接提交给 Agent。

这是 P1 的可测试最小实现，后续接入向量召回时不能绕过身份、权限和状态过滤。

## 具身表达协议

模型返回的是受限的 `embodiment`，不是设备代码：

```text
state: idle | listening | thinking | speaking | reacting | error
emotionId: neutral | happy | curious | thinking | concerned | surprised
attentionTarget: child | spot | none
speechSync: before | during | after | none
hapticPattern: none | soft_short | double_short | soft_long
sfxId: none | curious_ping | soft_chime | success_tone
```

端侧后续只需要把这些高层枚举映射为眼睛、震动、音效和 TTS 行为。模型不能自行生成 GPIO、串口、脚本或任意设备指令。

## 芙崽路线中本阶段没有实现的内容

- 流式 ASR、TTS、AEC、NS、VAD。
- `≤350ms` 打断链路。
- `P50≤1.5s / P95≤2.8s` 首段语音指标。
- BK7258/ESP32-S3 固件和设备协议。
- 单屏双眼动画、触摸、IMU、震动和 OTA。
- 主备语音供应商。
- PostgreSQL/CloudBase 持久化和异步反思队列。
- 真实通义/百炼 Provider。

这些属于语音网关、硬件固件、生产数据层或供应商接入工作，当前代码只保留接口边界。

## 固定路由和版本字符串

```text
GET  /api/v1/development/companion-reply-fixture
POST /api/v1/agent/companion-reply
scene = companion_reply
promptVersion = yuanlong.companion-reply.v1
schemaVersion = agent-request.v1 / agent-response.v1

Journey 读取路由：

```text
GET /api/v1/development/journey-catalog
GET /api/v1/journey/zones
GET /api/v1/journey/landmarks?zoneId=...
GET /api/v1/journey/spots?landmarkId=...
GET /api/v1/journey/quests?spotId=...
POST /api/v1/journey/quest-progress
```

`Zone → Landmark → Spot → Quest` 是内容层级关系，不是四个 Agent。目录存储负责父子关系和发布状态，Agent 只接收当前 Spot 经过筛选的事实。

Quest 状态机当前只保留两个可持久化状态：`in_progress` 和 `completed`。`start` 只能创建一次；`submit` 必须存在已开始记录，并且所有提交证据必须是已验证、类型被 Quest 接受的 `choice` 或 `verified_transcript`。重复开始、未开始提交、未验证证据都会直接报错。
```
