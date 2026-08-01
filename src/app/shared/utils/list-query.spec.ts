import { ListQuery, nextSort, runQuery, sortRows } from './list-query';

interface Row {
  code: string;
  qty: number;
  status: string;
  owner?: string;
}

const ROWS: Row[] = [
  { code: 'B-02', qty: 30, status: 'open', owner: 'Ada' },
  { code: 'A-10', qty: 200, status: 'closed' },
  { code: 'A-2', qty: 5, status: 'open', owner: 'Bora' },
  { code: 'C-01', qty: 120, status: 'open', owner: 'Ada' },
];

const accessor = (row: Row, key: string): unknown => (row as unknown as Record<string, unknown>)[key];

function query(overrides: Partial<ListQuery> = {}): ListQuery {
  return { page: 1, pageSize: 10, ...overrides };
}

describe('nextSort', () => {
  it('starts a new column ascending', () => {
    expect(nextSort(null, 'code')).toEqual({ key: 'code', direction: 'asc' });
  });

  it('flips direction when the same column is clicked again', () => {
    expect(nextSort({ key: 'code', direction: 'asc' }, 'code')).toEqual({ key: 'code', direction: 'desc' });
    expect(nextSort({ key: 'code', direction: 'desc' }, 'code')).toEqual({ key: 'code', direction: 'asc' });
  });

  it('resets to ascending when switching column', () => {
    expect(nextSort({ key: 'code', direction: 'desc' }, 'qty')).toEqual({ key: 'qty', direction: 'asc' });
  });
});

describe('sortRows', () => {
  it('leaves the array untouched when no sort is given', () => {
    expect(sortRows(ROWS, null, accessor)).toBe(ROWS);
  });

  it('does not mutate the source array', () => {
    const before = [...ROWS];
    sortRows(ROWS, { key: 'qty', direction: 'desc' }, accessor);
    expect(ROWS).toEqual(before);
  });

  it('sorts numbers numerically, not lexically', () => {
    const sorted = sortRows(ROWS, { key: 'qty', direction: 'asc' }, accessor);
    expect(sorted.map((r) => r.qty)).toEqual([5, 30, 120, 200]);
  });

  it('sorts codes naturally so A-2 precedes A-10', () => {
    const sorted = sortRows(ROWS, { key: 'code', direction: 'asc' }, accessor);
    expect(sorted.map((r) => r.code)).toEqual(['A-2', 'A-10', 'B-02', 'C-01']);
  });

  it('places missing values first when ascending', () => {
    const sorted = sortRows(ROWS, { key: 'owner', direction: 'asc' }, accessor);
    expect(sorted[0].owner).toBeUndefined();
  });
});

describe('runQuery', () => {
  it('reports the total before pagination', () => {
    const result = runQuery(ROWS, query({ pageSize: 2 }), { accessor });
    expect(result.total).toBe(4);
    expect(result.rows.length).toBe(2);
    expect(result.totalPages).toBe(2);
  });

  it('filters by an equality filter and ignores "all"', () => {
    expect(runQuery(ROWS, query({ filters: { status: 'open' } }), { accessor }).total).toBe(3);
    expect(runQuery(ROWS, query({ filters: { status: 'all' } }), { accessor }).total).toBe(4);
  });

  it('searches case-insensitively across the declared fields', () => {
    const result = runQuery(ROWS, query({ search: 'ada' }), {
      accessor,
      searchable: (r) => [r.code, r.owner ?? ''],
    });
    expect(result.total).toBe(2);
  });

  it('clamps a page beyond the end back into range', () => {
    const result = runQuery(ROWS, query({ page: 99, pageSize: 2 }), { accessor });
    expect(result.page).toBe(2);
    expect(result.rows.length).toBe(2);
  });

  it('reports one empty page when nothing matches', () => {
    const result = runQuery(ROWS, query({ search: 'zzz' }), { accessor, searchable: (r) => [r.code] });
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.rows).toEqual([]);
  });

  it('applies filter, sort and pagination together', () => {
    const result = runQuery(ROWS, query({ filters: { status: 'open' }, sort: { key: 'qty', direction: 'desc' }, pageSize: 2 }), {
      accessor,
    });
    expect(result.total).toBe(3);
    expect(result.rows.map((r) => r.qty)).toEqual([120, 30]);
  });
});
