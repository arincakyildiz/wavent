import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { db } from '../../data-access/mock-data';
import { waveOrderStatuses } from '../../data-access/selectors';
import { WavePlanningStore } from '../../state/wave-planning.store';
import { WaveDetailComponent } from './wave-detail.component';

/**
 * Integration test for the second main flow: publishing a wave. It covers what the
 * resolve flow does not — a partial result (§11), the mandatory justification that
 * a knowingly-partial publish requires (§10), and the optimistic-concurrency
 * conflict a stale screen produces.
 */
describe('WaveDetailComponent — release flow', () => {
  let fixture: ComponentFixture<WaveDetailComponent>;
  let component: WaveDetailComponent;
  let confirm: ConfirmDialogService;
  let audit: AuditService;
  let notifications: NotificationService;
  let store: WavePlanningStore;

  let restore: (() => void) | null = null;
  let targetId = '';

  /**
   * A wave that is publishable AND has at least one order that will actually go —
   * a wave short on every order legitimately rejects the whole call, which is a
   * different case from the partial result under test.
   */
  function pickReleasableWave() {
    return db.waves.find(
      (w) =>
        (w.status === 'planned' || w.status === 'draft') &&
        waveOrderStatuses(w.id).some((s) => s.status !== 'stock-shortage'),
    );
  }

  beforeEach(async () => {
    const wave = pickReleasableWave();
    targetId = wave?.id ?? '';

    if (wave) {
      const snapshot = { status: wave.status, version: wave.version };
      const orderStatuses = wave.orderNumbers.map((number) => {
        const order = db.orders.find((o) => o.number === number);
        return { order, status: order?.status };
      });

      restore = () => {
        wave.status = snapshot.status;
        wave.version = snapshot.version;
        for (const entry of orderStatuses) {
          if (entry.order && entry.status) entry.order.status = entry.status;
        }
      };
    }

    await TestBed.configureTestingModule({
      imports: [WaveDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => targetId } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WaveDetailComponent);
    component = fixture.componentInstance;
    confirm = TestBed.inject(ConfirmDialogService);
    audit = TestBed.inject(AuditService);
    notifications = TestBed.inject(NotificationService);
    store = TestBed.inject(WavePlanningStore);

    fixture.detectChanges();
  });

  afterEach(() => {
    restore?.();
    restore = null;
    notifications.clear();
    store.clear();
  });

  /**
   * The component loads in its constructor, i.e. in `beforeEach` — outside the fake
   * zone — so those timers can never be flushed by `tick()`. Re-issuing the load
   * inside the fakeAsync body puts the request on the fake clock instead.
   */
  function loadInFakeZone(): void {
    component.load();
    tick(1000);
    fixture.detectChanges();
  }

  it('loads the wave and its per-order publish verdicts', async () => {
    if (!targetId) return pending('no releasable wave in dataset');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.wave()?.id).toBe(targetId);
    expect(component.orders().length).toBeGreaterThan(0);
  });

  it('leaves the wave untouched when the operator cancels', fakeAsync(() => {
    if (!targetId) return pending('no releasable wave in dataset');

    loadInFakeZone();

    const before = component.wave()!.status;
    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));
    const auditBefore = audit.sessionCount();

    component.releaseWave();
    tick(1000);

    expect(db.waves.find((w) => w.id === targetId)!.status).toBe(before);
    expect(audit.sessionCount()).toBe(auditBefore);
  }));

  it('demands a justification when the publish knowingly leaves orders behind', fakeAsync(() => {
    if (!targetId) return pending('no releasable wave in dataset');

    loadInFakeZone();

    const ask = spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));
    const hasShortage = component.shortageCount() > 0;

    component.releaseWave();
    tick(1000);

    expect(ask).toHaveBeenCalled();
    // §10: a partial publish needs a recorded reason; a clean one does not.
    expect(ask.calls.mostRecent().args[0].requireReason).toBe(hasShortage);
  }));

  it('publishes, reports the per-order result and writes an audit event', fakeAsync(() => {
    if (!targetId) return pending('no releasable wave in dataset');

    loadInFakeZone();

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: 'Kısmi yayına onay verildi' }));

    component.releaseWave();
    tick(1000);
    fixture.detectChanges();

    expect(db.waves.find((w) => w.id === targetId)!.status).toBe('released');

    // §11: the result is per-order, not all-or-nothing.
    const result = component.lastRelease()!;
    expect(result.released.length).toBeGreaterThan(0);
    expect(result.released.length + result.failed.length).toBe(component.orders().length);
    for (const failure of result.failed) {
      expect(failure.reason).toBeTruthy();
    }

    const recorded = audit.events()[0];
    expect(recorded.actionType).toBe('Wave Released');

    expect(notifications.notifications().length).toBeGreaterThan(0);
  }));

  it('surfaces a version conflict instead of overwriting a newer publish', fakeAsync(() => {
    if (!targetId) return pending('no releasable wave in dataset');

    loadInFakeZone();

    // Someone else published between this screen loading and the operator clicking.
    const record = db.waves.find((w) => w.id === targetId)!;
    record.version += 1;

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: 'Yayın denemesi' }));

    component.releaseWave();
    tick(1000);
    fixture.detectChanges();

    expect(record.status).not.toBe('released');
    expect(notifications.notifications()[0].kind).toBe('error');
  }));

  it('keeps the store in step so a later visit does not serve a stale version', fakeAsync(() => {
    if (!targetId) return pending('no releasable wave in dataset');

    loadInFakeZone();

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: 'Kısmi yayına onay verildi' }));

    component.releaseWave();
    tick(1000);
    fixture.detectChanges();

    const cached = store.allWaves().find((w) => w.id === targetId);
    expect(cached?.status).toBe('released');
    expect(cached?.version).toBe(db.waves.find((w) => w.id === targetId)!.version);
  }));
});
