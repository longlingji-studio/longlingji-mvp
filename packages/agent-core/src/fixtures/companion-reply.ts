import type {
  CompanionReplyRequestInput,
  MemoryRecord,
} from "../contracts.js";

export const companionReplyFixture = {
  schemaVersion: "agent-request.v1",
  requestId: "dev-request:companion:001",
  scene: "companion_reply",
  householdId: "household:dev:001",
  childProfileId: "child:dev:001",
  characterInstanceId: "character:dev:001",
  childAgeBand: "6_7",
  locale: "zh-CN",
  input: {
    evidenceId: "submission:dev:transcript:001",
    type: "verified_transcript",
    text: "你还记得我们上次看到的铜狮吗？",
    confidence: 0.99,
    confirmedByChild: false,
  },
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
  personality: {
    personalityVersion: 1,
    baselineArchetype: "yuanlong:curious-gentle-v1",
    traits: [
      { traitId: "exploration", value: 0.8 },
    ],
    mood: {
      valence: 0.7,
      arousal: 0.4,
      curiosity: 0.8,
      fatigue: 0.1,
    },
    relationship: {
      familiarity: 0.2,
      trust: 0.3,
      sharedExperienceCount: 1,
    },
    scene: {
      quietHours: false,
      initiative: 0.5,
    },
  },
  interaction: {
    isPublic: false,
  },
  capabilities: {
    camera: false,
    microphone: true,
    location: false,
    network: false,
    knowledgeRetrieval: true,
    memory: true,
  },
  reportedSafetyCode: "none",
} as const satisfies CompanionReplyRequestInput;

export const companionMemoryFixture = {
  id: "memory:dev:bronze-lions:001",
  householdId: "household:dev:001",
  childProfileId: "child:dev:001",
  characterInstanceId: "character:dev:001",
  kind: "event",
  text: "孩子在太和门发现了两只铜狮脚下的东西不一样。",
  sourceEventIds: ["submission:dev:choice:001"],
  sourceType: "user_stated",
  confidence: 0.98,
  privacyLevel: "ordinary",
  guardianVisibility: "summary_visible",
  occurredAt: "2026-08-17T09:00:00.000Z",
  retentionUntil: "2027-08-17T09:00:00.000Z",
  status: "active",
} as const satisfies MemoryRecord;
