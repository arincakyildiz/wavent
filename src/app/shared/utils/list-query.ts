export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface ListQuery {
  search?: string;
  page: number;
  pageSize: number;
  sort?: SortState | null;
  /** Arbitrary equality filters, e.g. { status: 'released' }. */
  filters?: Record<string, string | undefined>;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Flip direction when the same column is clicked again, otherwise start ascending. */
export function nextSort(current: SortState | null, key: string): SortState {
  if (current?.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
}

export function sortRows<T>(rows: T[], sort: SortState | null | undefined, accessor: (row: T, key: string) => unknown): T[] {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;
  // Copy first — callers pass shared arrays that must not be reordered in place.
  return [...rows].sort((a, b) => compare(accessor(a, sort.key), accessor(b, sort.key)) * factor);
}

/**
 * Applies search, equality filters, sorting and pagination the way a server would,
 * returning a total count so the UI can render real pagination rather than slicing
 * a list it already holds in full.
 */
export function runQuery<T>(
  source: T[],
  query: ListQuery,
  options: {
    searchable?: (row: T) => string[];
    accessor: (row: T, key: string) => unknown;
  },
): ListResult<T> {
  let rows = source;

  const term = query.search?.trim().toLowerCase();
  if (term && options.searchable) {
    rows = rows.filter((row) =>
      options.searchable!(row).some((field) => field?.toLowerCase().includes(term)),
    );
  }

  const filters = query.filters ?? {};
  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === 'all') continue;
    rows = rows.filter((row) => String(options.accessor(row, key)) === value);
  }

  rows = sortRows(rows, query.sort, options.accessor);

  const total = rows.length;
  const pageSize = Math.max(1, query.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}
