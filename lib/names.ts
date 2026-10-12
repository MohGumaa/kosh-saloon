/** How person names are shortened for display. Pure, so client components can use it. */

/** The name up to its first space: "Tamir Abdelrahman" becomes "Tamir". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

/**
 * The label for each employee row: the first name, or the full name when another row
 * has the same first name (case-insensitive), so rows stay distinguishable.
 */
export function employeeLabels(names: readonly string[], locale?: string): string[] {
  const firstNames = names.map(firstName);
  const key = (first: string) => first.toLocaleLowerCase(locale);
  const counts = new Map<string, number>();
  for (const first of firstNames) counts.set(key(first), (counts.get(key(first)) ?? 0) + 1);
  return firstNames.map((first, i) => (counts.get(key(first))! > 1 ? names[i].trim() : first));
}

/**
 * One label per person in a table, keyed by id. A person listed on several rows (or in
 * several columns) counts once, so only different people with the same first name clash.
 */
export function nameLabels(
  people: Iterable<{ id: string; name: string }>,
  locale?: string,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const person of people) names.set(person.id, person.name);
  const labels = employeeLabels([...names.values()], locale);
  return new Map([...names.keys()].map((id, i) => [id, labels[i]]));
}
