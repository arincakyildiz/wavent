import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { IndexedDbService } from './indexed-db.service';

/**
 * The offline cache has to be honest about age and degrade rather than throw, since
 * a stale figure presented as live is worse than no figure at all.
 */
describe('IndexedDbService', () => {
  let service: IndexedDbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedDbService);
    await firstValueFrom(service.clear());
  });

  afterEach(async () => {
    await firstValueFrom(service.clear());
  });

  it('round-trips a stored snapshot', async () => {
    const payload = { total: 42, rows: ['a', 'b'] };

    const written = await firstValueFrom(service.write('spec:key', payload));
    expect(written).toBe(true);

    const cached = await firstValueFrom(service.read<typeof payload>('spec:key'));
    expect(cached).not.toBeNull();
    expect(cached!.value).toEqual(payload);
  });

  it('reports how old the snapshot is', async () => {
    await firstValueFrom(service.write('spec:key', { n: 1 }));

    const cached = await firstValueFrom(service.read<{ n: number }>('spec:key'));
    expect(cached!.ageMs).toBeGreaterThanOrEqual(0);
    expect(cached!.savedAt instanceof Date).toBe(true);
  });

  it('returns null for a key that was never written', async () => {
    const cached = await firstValueFrom(service.read('spec:absent'));
    expect(cached).toBeNull();
  });

  it('refuses a snapshot older than the caller allows', async () => {
    await firstValueFrom(service.write('spec:key', { n: 1 }));

    // Let it age past the window, then ask for something fresher than it now is.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(await firstValueFrom(service.read('spec:key', 10))).toBeNull();
    // The record itself is intact — only this caller's freshness bar rejected it.
    expect(await firstValueFrom(service.read('spec:key'))).not.toBeNull();
  });

  it('removes a single key without touching the rest', async () => {
    await firstValueFrom(service.write('spec:a', 1));
    await firstValueFrom(service.write('spec:b', 2));

    await firstValueFrom(service.remove('spec:a'));

    expect(await firstValueFrom(service.read('spec:a'))).toBeNull();
    expect((await firstValueFrom(service.read<number>('spec:b')))!.value).toBe(2);
  });

  it('overwrites an existing key rather than duplicating it', async () => {
    await firstValueFrom(service.write('spec:key', { n: 1 }));
    await firstValueFrom(service.write('spec:key', { n: 2 }));

    const cached = await firstValueFrom(service.read<{ n: number }>('spec:key'));
    expect(cached!.value.n).toBe(2);
  });
});
