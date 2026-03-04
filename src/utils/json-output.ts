import pc from "picocolors";

export function parseJsonFields(fieldsArg: string, allowedFields: string[]): string[] {
  const fields = fieldsArg.split(",").map((f) => f.trim()).filter(Boolean);

  const invalid = fields.filter((f) => !allowedFields.includes(f));
  if (invalid.length > 0) {
    console.log(
      pc.red(`Unknown field(s): ${invalid.join(", ")}`) +
        `\nAvailable: ${allowedFields.join(", ")}`
    );
    process.exit(1);
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
