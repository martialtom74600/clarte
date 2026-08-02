import { describe, expect, it } from "vitest";
import {
  deptFromPostal,
  pricePerSqmForDept,
  pricePerSqmForPostal,
  samplePostalsForDept,
  PRICE_PER_SQM_BY_DEPT,
} from "./market-prices.js";
import { rentPerSqm, RENT_PER_SQM_BY_DEPT } from "./market-rents.js";

describe("deptFromPostal — France entière", () => {
  it("métropole, Corse, DROM", () => {
    expect(deptFromPostal("75011")).toBe("75");
    expect(deptFromPostal("44000")).toBe("44");
    expect(deptFromPostal("20000")).toBe("2A");
    expect(deptFromPostal("20200")).toBe("2B");
    expect(deptFromPostal("97110")).toBe("971");
    expect(deptFromPostal("97400")).toBe("974");
  });
});

describe("barèmes départementaux", () => {
  it("couvre tous les départements métropolitains + DROM", () => {
    const metro = Object.keys(PRICE_PER_SQM_BY_DEPT).filter((k) => k !== "default");
    expect(metro.length).toBeGreaterThanOrEqual(100);
    expect(pricePerSqmForDept("75")).toBeGreaterThan(8000);
    expect(pricePerSqmForDept("23")).toBeLessThan(1500);
    expect(pricePerSqmForPostal("31000")).toBe(PRICE_PER_SQM_BY_DEPT["31"]);
    expect(rentPerSqm("75011")).toBe(RENT_PER_SQM_BY_DEPT["75"]);
    expect(rentPerSqm("58000")).toBe(RENT_PER_SQM_BY_DEPT["58"]);
  });

  it("fournit des CP d'échantillon DVF par département", () => {
    expect(samplePostalsForDept("75", "75011")).toContain("75011");
    expect(samplePostalsForDept("44")).toContain("44000");
    expect(samplePostalsForDept("971")).toContain("97110");
  });
});
