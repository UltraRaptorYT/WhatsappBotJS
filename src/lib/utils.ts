import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function toE164(raw: string, defaultCC = "+65") {
  // 1. If no value is given, return null
  if (!raw) return null;

  // 2. Strip out anything except digits and '+' sign
  const digits = raw.replace(/[^\d+]/g, "");

  // 3. If it already looks like E.164 (e.g., "+6598765432")
  if (/^\+\d{6,15}$/.test(digits)) return digits;

  // 4. Special case: Singapore 8-digit local number -> prepend +65
  if (/^\d{8}$/.test(digits)) return `${defaultCC}${digits}`;

  // 5. Everything else is considered invalid
  return null;
}

export function fillTemplate(tmpl: string, row: Record<string, any>) {
  // Replace {ColumnName} with row[ColumnName]; if missing, leave as-is
  return tmpl.replace(/\{([^}]+)\}/g, (_m, key) => {
    const v = row?.[key];
    return v === undefined || v === null ? _m : String(v);
  });
}
