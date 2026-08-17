import {
  contentFactSchema,
  contentModeSchema,
  stableIdSchema,
} from "./journey-primitives.js";
import { z } from "zod";

const reviewStatusSchema = z.enum(["draft", "approved", "archived"]);

export const zoneSchema = z
  .object({
    id: stableIdSchema,
    name: z.string().trim().min(1).max(80),
    city: z.string().trim().min(1).max(40),
    summary: z.string().trim().min(1).max(240),
    contentMode: contentModeSchema,
    reviewStatus: reviewStatusSchema,
  })
  .strict();

export const landmarkSchema = z
  .object({
    id: stableIdSchema,
    zoneId: stableIdSchema,
    name: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    reviewStatus: reviewStatusSchema,
  })
  .strict();

export const spotSchema = z
  .object({
    id: stableIdSchema,
    landmarkId: stableIdSchema,
    name: z.string().trim().min(1).max(80),
    observationPrompt: z.string().trim().min(1).max(240),
    facts: z.array(contentFactSchema).max(20),
    reviewStatus: reviewStatusSchema,
  })
  .strict();

export const questSchema = z
  .object({
    id: stableIdSchema,
    spotId: stableIdSchema,
    title: z.string().trim().min(1).max(80),
    instruction: z.string().trim().min(1).max(240),
    acceptedEvidenceTypes: z
      .array(z.enum(["choice", "verified_transcript"]))
      .min(1)
      .max(2),
    reviewStatus: reviewStatusSchema,
  })
  .strict();

export const journeyCatalogSchema = z
  .object({
    zones: z.array(zoneSchema),
    landmarks: z.array(landmarkSchema),
    spots: z.array(spotSchema),
    quests: z.array(questSchema),
  })
  .strict();

export type Zone = z.infer<typeof zoneSchema>;
export type Landmark = z.infer<typeof landmarkSchema>;
export type Spot = z.infer<typeof spotSchema>;
export type Quest = z.infer<typeof questSchema>;
export type JourneyCatalog = z.infer<typeof journeyCatalogSchema>;

export interface JourneyCatalogStore {
  listZones(): readonly Zone[];
  getZone(zoneId: string): Zone;
  listLandmarks(zoneId: string): readonly Landmark[];
  getLandmark(landmarkId: string): Landmark;
  listSpots(landmarkId: string): readonly Spot[];
  getSpot(spotId: string): Spot;
  listQuests(spotId: string): readonly Quest[];
  getQuest(questId: string): Quest;
}

function notFound(kind: string, id: string): Error {
  return new Error(`JOURNEY_${kind.toUpperCase()}_NOT_FOUND:${id}`);
}

export class InMemoryJourneyCatalogStore implements JourneyCatalogStore {
  private readonly catalog: JourneyCatalog;

  public constructor(catalog: JourneyCatalog) {
    this.catalog = journeyCatalogSchema.parse(catalog);
    this.assertRelationships();
  }

  public listZones(): readonly Zone[] {
    return this.catalog.zones.filter((zone) => zone.reviewStatus === "approved");
  }

  public getZone(zoneId: string): Zone {
    const zone = this.catalog.zones.find((item) => item.id === zoneId);
    if (zone === undefined) {
      throw notFound("zone", zoneId);
    }
    return zone;
  }

  public listLandmarks(zoneId: string): readonly Landmark[] {
    this.getZone(zoneId);
    return this.catalog.landmarks.filter(
      (landmark) =>
        landmark.zoneId === zoneId && landmark.reviewStatus === "approved",
    );
  }

  public getLandmark(landmarkId: string): Landmark {
    const landmark = this.catalog.landmarks.find(
      (item) => item.id === landmarkId,
    );
    if (landmark === undefined) {
      throw notFound("landmark", landmarkId);
    }
    return landmark;
  }

  public listSpots(landmarkId: string): readonly Spot[] {
    this.getLandmark(landmarkId);
    return this.catalog.spots.filter(
      (spot) =>
        spot.landmarkId === landmarkId && spot.reviewStatus === "approved",
    );
  }

  public getSpot(spotId: string): Spot {
    const spot = this.catalog.spots.find((item) => item.id === spotId);
    if (spot === undefined) {
      throw notFound("spot", spotId);
    }
    return spot;
  }

  public listQuests(spotId: string): readonly Quest[] {
    this.getSpot(spotId);
    return this.catalog.quests.filter(
      (quest) => quest.spotId === spotId && quest.reviewStatus === "approved",
    );
  }

  public getQuest(questId: string): Quest {
    const quest = this.catalog.quests.find((item) => item.id === questId);
    if (quest === undefined) {
      throw notFound("quest", questId);
    }
    return quest;
  }

  private assertRelationships(): void {
    const zoneIds = new Set(this.catalog.zones.map((zone) => zone.id));
    const landmarkIds = new Set(
      this.catalog.landmarks.map((landmark) => landmark.id),
    );
    const spotIds = new Set(this.catalog.spots.map((spot) => spot.id));

    for (const landmark of this.catalog.landmarks) {
      if (!zoneIds.has(landmark.zoneId)) {
        throw new Error(`JOURNEY_LANDMARK_ZONE_MISSING:${landmark.id}`);
      }
    }
    for (const spot of this.catalog.spots) {
      if (!landmarkIds.has(spot.landmarkId)) {
        throw new Error(`JOURNEY_SPOT_LANDMARK_MISSING:${spot.id}`);
      }
    }
    for (const quest of this.catalog.quests) {
      if (!spotIds.has(quest.spotId)) {
        throw new Error(`JOURNEY_QUEST_SPOT_MISSING:${quest.id}`);
      }
    }
  }
}
