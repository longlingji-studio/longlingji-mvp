import type { JourneyCatalog } from "../journey.js";

export const journeyCatalogFixture = {
  zones: [
    {
      id: "zone:beijing:forbidden-city",
      name: "故宫观察线",
      city: "北京",
      summary: "从故宫里的一处细节开始，练习停下来观察。",
      contentMode: "development_only",
      reviewStatus: "approved",
    },
  ],
  landmarks: [
    {
      id: "landmark:beijing:forbidden-city:taihemen",
      zoneId: "zone:beijing:forbidden-city",
      name: "太和门",
      summary: "一处可以观察门前铜狮的故宫地标。",
      reviewStatus: "approved",
    },
  ],
  spots: [
    {
      id: "spot:beijing:taihemen:bronze-lions",
      landmarkId: "landmark:beijing:forbidden-city:taihemen",
      name: "铜狮脚下藏着什么",
      observationPrompt: "仔细看看两只铜狮脚下，它们保护的东西一样吗？",
      facts: [
        {
          id: "fact:fc:taihemen:bronze-lions:objects@dev-v1",
          text: "一只铜狮脚下踩着绣球，另一只铜狮脚下护着幼狮。",
          reviewStatus: "approved",
        },
      ],
      reviewStatus: "approved",
    },
  ],
  quests: [
    {
      id: "quest:beijing:taihemen:bronze-lions:observe",
      spotId: "spot:beijing:taihemen:bronze-lions",
      title: "找出不同",
      instruction: "告诉元珑：两只铜狮脚下分别有什么？",
      acceptedEvidenceTypes: ["choice", "verified_transcript"],
      reviewStatus: "approved",
    },
  ],
} as const satisfies JourneyCatalog;
