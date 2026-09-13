export function compareBySortOrder<T extends { sort_order: number }>(
  a: T,
  b: T,
  tiebreaker: (left: T, right: T) => number,
) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return tiebreaker(a, b);
}

export function sortBySortOrder<T extends { sort_order: number }>(
  items: T[],
  tiebreaker: (left: T, right: T) => number,
) {
  return [...items].sort((a, b) => compareBySortOrder(a, b, tiebreaker));
}

export function getDuplicateSortOrders<T extends { sort_order: number }>(items: T[]) {
  const counts = new Map<number, number>();

  for (const item of items) {
    counts.set(item.sort_order, (counts.get(item.sort_order) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([sortOrder]) => sortOrder),
  );
}
