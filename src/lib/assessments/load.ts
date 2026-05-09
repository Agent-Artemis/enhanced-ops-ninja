import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { assessmentConfigSchema, type AssessmentConfig } from "./schema";

const CACHE = new Map<string, AssessmentConfig>();

function configPath(filename: string) {
  return path.join(process.cwd(), "config", "assessments", filename);
}

export async function loadAssessmentConfig(
  filename:
    | "free-healthcare.json"
    | "free-business.json"
    | "paid-healthcare.json"
    | "paid-business.json",
): Promise<AssessmentConfig> {
  if (CACHE.has(filename)) {
    return CACHE.get(filename)!;
  }

  const raw = await readFile(configPath(filename), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const config = assessmentConfigSchema.parse(parsed);
  CACHE.set(filename, config);
  return config;
}

export function assessmentConfigFilename(
  tier: "free" | "paid",
  track: "healthcare" | "business",
): "free-healthcare.json" | "free-business.json" | "paid-healthcare.json" | "paid-business.json" {
  if (tier === "free" && track === "healthcare") return "free-healthcare.json";
  if (tier === "free" && track === "business") return "free-business.json";
  if (tier === "paid" && track === "healthcare") return "paid-healthcare.json";
  return "paid-business.json";
}
