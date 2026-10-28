import Constants from "expo-constants";

// app.config.ts `extra`, read defensively: the web manifest turns a null into {}, so a value that
// is not of the expected type counts as unset.

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export function extraString(key: string): string | null {
  const value = extra[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extraNumber(key: string): number | null {
  const value = extra[key];
  return typeof value === "number" ? value : null;
}

export function extraStrings(key: string): string[] {
  const value = extra[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}
