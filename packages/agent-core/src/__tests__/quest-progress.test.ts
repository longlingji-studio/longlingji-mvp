import { describe, expect, it } from "vitest";

import { journeyCatalogFixture, InMemoryJourneyCatalogStore } from "../index.js";
import {
  InMemoryQuestProgressStore,
  runQuestProgress,
} from "../quest-progress.js";

const questId = "quest:beijing:taihemen:bronze-lions:observe";
const scope = {
  householdId: "household:test:001",
  childProfileId: "child:test:001",
};

function command(action: "start" | "submit") {
  if (action === "start") {
    return {
      schemaVersion: "quest-request.v1" as const,
      action,
      ...scope,
      questId,
    };
  }
  return {
    schemaVersion: "quest-request.v1" as const,
    action,
    ...scope,
    questId,
    evidence: [
      {
        id: "evidence:test:001",
        type: "verified_transcript" as const,
        verification: "verified" as const,
        value: "一只脚下是绣球，一只脚下是幼狮。",
        confidence: 0.99,
      },
    ],
  };
}

describe("quest progress", () => {
  it("moves a quest from start to completed", () => {
    const catalog = new InMemoryJourneyCatalogStore(journeyCatalogFixture);
    const store = new InMemoryQuestProgressStore();
    const lookup = (id: string) => catalog.getQuest(id);

    const started = runQuestProgress(command("start"), lookup, store, "2026-08-17T10:00:00.000Z");
    expect(started.status).toBe("in_progress");
    const completed = runQuestProgress(command("submit"), lookup, store, "2026-08-17T10:01:00.000Z");
    expect(completed.status).toBe("completed");
    expect(completed.evidenceIds).toEqual(["evidence:test:001"]);
  });

  it("rejects completion before start", () => {
    const catalog = new InMemoryJourneyCatalogStore(journeyCatalogFixture);
    const store = new InMemoryQuestProgressStore();

    expect(() =>
      runQuestProgress(
        command("submit"),
        (id) => catalog.getQuest(id),
        store,
        "2026-08-17T10:00:00.000Z",
      ),
    ).toThrow("QUEST_NOT_STARTED");
  });

  it("rejects unverified evidence", () => {
    const catalog = new InMemoryJourneyCatalogStore(journeyCatalogFixture);
    const store = new InMemoryQuestProgressStore();
    const submitCommand = command("submit");
    if (submitCommand.action !== "submit") {
      throw new Error("Expected a submit command");
    }
    const evidence = submitCommand.evidence[0];
    if (evidence === undefined) {
      throw new Error("Expected submit evidence");
    }
    runQuestProgress(
      command("start"),
      (id) => catalog.getQuest(id),
      store,
      "2026-08-17T10:00:00.000Z",
    );

    expect(() =>
      runQuestProgress(
        {
          ...submitCommand,
          evidence: [
            {
              ...evidence,
              verification: "unverified" as const,
            },
          ],
        },
        (id) => catalog.getQuest(id),
        store,
        "2026-08-17T10:01:00.000Z",
      ),
    ).toThrow("QUEST_EVIDENCE_NOT_VERIFIED");
  });

  it("rejects a second start instead of resetting progress", () => {
    const catalog = new InMemoryJourneyCatalogStore(journeyCatalogFixture);
    const store = new InMemoryQuestProgressStore();
    runQuestProgress(
      command("start"),
      (id) => catalog.getQuest(id),
      store,
      "2026-08-17T10:00:00.000Z",
    );

    expect(() =>
      runQuestProgress(
        command("start"),
        (id) => catalog.getQuest(id),
        store,
        "2026-08-17T10:01:00.000Z",
      ),
    ).toThrow("QUEST_ALREADY_STARTED");
  });

  it("does not start a draft quest", () => {
    const catalog = new InMemoryJourneyCatalogStore({
      ...journeyCatalogFixture,
      quests: [
        {
          ...journeyCatalogFixture.quests[0],
          reviewStatus: "draft",
        },
      ],
    });
    const store = new InMemoryQuestProgressStore();

    expect(() =>
      runQuestProgress(
        command("start"),
        (id) => catalog.getQuest(id),
        store,
        "2026-08-17T10:00:00.000Z",
      ),
    ).toThrow("QUEST_NOT_PUBLISHED");
  });
});
