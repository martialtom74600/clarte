import { describe, it, expect } from "vitest";
import {
  SHARE_SNAPSHOT_KIND,
  getShareSnapshot,
  isShareSnapshot,
  saveShareSnapshot,
} from "./share-snapshot-store";
import type { ExpertExportPack } from "./separation/export-bilan-model";

const minimalPack = {
  dateLabel: "3 août 2026",
  coverSubtitle: "Test",
  footprint: [],
  activeLevers: [],
  matrix: [],
  chapters: [
    {
      doorId: "sell",
      title: "Vendre",
      verdict: null,
      howItWorks: [{ title: "En clair", body: "x".repeat(50) }],
      nextSteps: ["a", "b"],
      bilan: {
        scenarioTitle: "Projet : vendre",
        dateLabel: "3 août 2026",
        footprint: [],
        activeLevers: [],
        insights: [],
        ledger: {
          doorId: "sell",
          doorTitle: "Vendre",
          verdict: null,
          lines: [],
        },
        disclaimer: "disclaimer",
      },
    },
  ],
  activeDoorId: "sell",
  disclaimer: "disclaimer",
} as ExpertExportPack;

describe("share-snapshot-store", () => {
  it("persiste et relit un snapshot", () => {
    const token = `test-${Date.now()}`;
    saveShareSnapshot(token, {
      kind: SHARE_SNAPSHOT_KIND,
      createdAt: new Date().toISOString(),
      recipientEmail: "autre@example.com",
      senderLabel: "Vous",
      pack: minimalPack,
    });
    const loaded = getShareSnapshot(token);
    expect(loaded?.pack.activeDoorId).toBe("sell");
    expect(isShareSnapshot(loaded)).toBe(true);
  });
});
