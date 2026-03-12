export function getTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null; 
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}