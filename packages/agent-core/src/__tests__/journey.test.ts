import { describe, expect, it } from "vitest";

import {
  InMemoryJourneyCatalogStore,
  journeyCatalogFixture,
} from "../index.js";

describe("journey catalog", () => {
  it("reads the hierarchy in Zone to Quest order", () => {
    const store = new InMemoryJourneyCatalogStore(journeyCatalogFixture);
    const zone = store.listZones()[0];

    if (zone === undefined) {
      throw new Error("Expected a development zone");
    }
    expect(zone.id).toBe("zone:beijing:forbidden-city");
    const landmark = store.listLandmarks(zone.id)[0];
    if (landmark === undefined) {
      throw new Error("Expected a development landmark");
    }
    expect(landmark.id).toBe(
      "landmark:beijing:forbidden-city:taihemen",
    );
    const spot = store.listSpots(landmark.id)[0];
    if (spot === undefined) {
      throw new Error("Expected a development spot");
    }
    expect(spot.id).toBe("spot:beijing:taihemen:bronze-lions");
    const quest = store.listQuests(spot.id)[0];
    if (quest === undefined) {
      throw new Error("Expected a development quest");
    }
    expect(quest.id).toBe("quest:beijing:taihemen:bronze-lions:observe");
  });

  it("does not expose draft content in list results", () => {
    const store = new InMemoryJourneyCatalogStore({
      ...journeyCatalogFixture,
      zones: [
        ...journeyCatalogFixture.zones,
        {
          ...journeyCatalogFixture.zones[0],
          id: "zone:beijing:draft",
          reviewStatus: "draft",
        },
      ],
    });

    expect(store.listZones()).toHaveLength(1);
  });

  it("rejects broken parent references at construction time", () => {
    expect(
      () =>
        new InMemoryJourneyCatalogStore({
          ...journeyCatalogFixture,
          landmarks: [
            {
              ...journeyCatalogFixture.landmarks[0],
              zoneId: "zone:missing",
            },
          ],
        }),
    ).toThrow("JOURNEY_LANDMARK_ZONE_MISSING");
  });

  it("exposes a missing node instead of silently returning an empty result", () => {
    const store = new InMemoryJourneyCatalogStore(journeyCatalogFixture);

    expect(() => store.listSpots("landmark:missing")).toThrow(
      "JOURNEY_LANDMARK_NOT_FOUND",
    );
  });
});
