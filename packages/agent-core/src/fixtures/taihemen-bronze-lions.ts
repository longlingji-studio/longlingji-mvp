import type { SpotFeedbackRequestInput } from "../contracts.js";

export const taihemenBronzeLionsFixture = {
  schemaVersion: "agent-request.v1",
  requestId: "dev-request:fc:taihemen-lions:001",
  scene: "spot_feedback",
  contentMode: "development_only",
  childAgeBand: "6_7",
  contentSnapshotId: "spot:fc:taihemen:bronze-lions@dev-v1",
  questSnapshotId: "quest:fc:taihemen:compare-lions@dev-v1",
  facts: [
    {
      id: "fact:fc:taihemen:bronze-lions:objects@dev-v1",
      text: "一只铜狮脚下踩着绣球，另一只铜狮脚下护着幼狮。",
      reviewStatus: "approved",
      source: {
        sourceId: "source:dev:forbidden-city@v1",
        title: "故宫博物院开发知识快照",
        url: "https://example.com/knowledge/forbidden-city",
        verifiedAt: "2026-08-21T00:00:00.000Z",
        knowledgeVersion: "knowledge:dev:forbidden-city@v1",
      },
    },
  ],
  evidence: [
    {
      id: "submission:dev:choice:001",
      type: "choice",
      verification: "verified",
      value: "孩子选择了：两只铜狮脚下的东西不一样。",
    },
  ],
  memory: null,
  reportedSafetyCode: "none",
} as const satisfies SpotFeedbackRequestInput;
