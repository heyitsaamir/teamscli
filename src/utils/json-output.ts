import { CliError } from "./errors.js";

export function parseJsonFields(fieldsArg: string, allowedFields: string[]): string[] {
  const fields = fieldsArg.split(",").map((f) => f.trim()).filter(Boolean);

  const invalid = fields.filter((f) => !allowedFields.includes(f));
  if (invalid.length > 0) {
    throw new CliError(
      "VALIDATION_FORMAT",
      `Unknown field(s): ${invalid.join(", ")}`,
      `Available: ${allowedFields.join(", ")}`,
    );
  }

  return fields;
}

export function pickFields<T extends object>(
  data: T | T[],
  fields: string[]
): Record<string, unknown> | Record<string, unknown>[] {
  const pick = (obj: T) => {
    const result: Record<string, unknown> = {};
    for (const f of fields) {
      result[f] = (obj as Record<string, unknown>)[f];
    }
    return result;
  };

  return Array.isArray(data) ? data.map(pick) : pick(data);
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
