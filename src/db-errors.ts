export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; constraint?: unknown };
  return (
    e.code === "23505" &&
    (constraint === undefined || e.constraint === constraint)
  );
}
