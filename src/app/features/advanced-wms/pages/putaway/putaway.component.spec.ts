import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FaultInjectionService } from '../../../../core/api/fault-injection.service';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { PutawaySuggestionRow } from '../../data-access/putaway.service';
import { db } from '../../data-access/mock-data';
import { PutawayComponent } from './putaway.component';

/**
 * Integration test for the third main flow: accepting a putaway suggestion.
 *
 * This is the app's optimistic-write path — the row flips before the server answers —
 * so the interesting cases are the rollback on failure and the capacity override,
 * neither of which the resolve/release flows exercise.
 */
describe('PutawayComponent — accept flow', () => {
  let fixture: ComponentFixture<PutawayComponent>;
  let component: PutawayComponent;
  let confirm: ConfirmDialogService;
  let audit: AuditService;
  let notifications: NotificationService;
  let faults: FaultInjectionService;

  let restore: (() => void) | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PutawayComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PutawayComponent);
    component = fixture.componentInstance;
    confirm = TestBed.inject(ConfirmDialogService);
    audit = TestBed.inject(AuditService);
    notifications = TestBed.inject(NotificationService);
    faults = TestBed.inject(FaultInjectionService);
    faults.reset();

    fixture.detectChanges();
  });

  afterEach(() => {
    restore?.();
    restore = null;
    notifications.clear();
    faults.reset();
  });

  /**
   * Re-issues the list load inside the fake zone — the constructor's load ran on the
   * real clock and can never be flushed by `tick()`. `reload()` only bumps a signal,
   * so change detection has to run first for the effect to fire the request.
   */
  function loadInFakeZone(): void {
    component.list.reload();
    fixture.detectChanges();
    tick(1000);
    fixture.detectChanges();
  }

  /** A pending suggestion, remembering how to put the record back. */
  function takePending(predicate: (r: PutawaySuggestionRow) => boolean = () => true) {
    const row = component.rows().find((r) => !r.accepted && predicate(r));
    if (!row) return null;

    const record = db.putaway.find((p) => p.id === row.id)!;
    const snapshot = { accepted: record.accepted, version: record.version };
    restore = () => {
      record.accepted = snapshot.accepted;
      record.version = snapshot.version;
    };
    return row;
  }

  it('loads putaway suggestions', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.rows().length).toBeGreaterThan(0);
    expect(component.list.error()).toBeNull();
  });

  it('accepts a suggestion that satisfies capacity without asking for a reason', fakeAsync(() => {
    loadInFakeZone();

    const row = takePending((r) => r.capacityOk);
    if (!row) return pending('no capacity-clean pending suggestion');

    const ask = spyOn(confirm, 'ask');

    component.accept(row);
    tick(1000);
    fixture.detectChanges();

    // A rule-compliant putaway is not a judgement call, so no dialog appears.
    expect(ask).not.toHaveBeenCalled();
    expect(db.putaway.find((p) => p.id === row.id)!.accepted).toBe(true);

    expect(audit.events()[0].actionType).toBe('Putaway Accepted');
    expect(notifications.notifications()[0].kind).toBe('success');
  }));

  it('demands a justified override when the suggestion breaks capacity', fakeAsync(() => {
    loadInFakeZone();

    const row = takePending((r) => !r.capacityOk);
    if (!row) return pending('no capacity-violating pending suggestion');

    const ask = spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));

    component.accept(row);
    tick(1000);

    expect(ask).toHaveBeenCalled();
    expect(ask.calls.mostRecent().args[0].requireReason).toBe(true);
    // Cancelling leaves the suggestion pending.
    expect(db.putaway.find((p) => p.id === row.id)!.accepted).toBe(false);
  }));

  it('rolls the optimistic row back when the write fails', fakeAsync(() => {
    loadInFakeZone();

    const row = takePending((r) => r.capacityOk);
    if (!row) return pending('no capacity-clean pending suggestion');

    // Force the next call to fail, so the optimistic flip has to be undone.
    faults.armNextFailure('network');

    component.accept(row);
    tick(1000);
    fixture.detectChanges();

    const after = component.rows().find((r) => r.id === row.id);
    expect(after?.accepted).toBe(false);
    expect(db.putaway.find((p) => p.id === row.id)!.accepted).toBe(false);

    const toast = notifications.notifications()[0];
    expect(toast.kind).toBe('error');
    // A failed optimistic write must offer a way back, not just report the failure.
    expect(toast.retry).toBeDefined();
  }));

  it('reports a stale row as a conflict rather than overwriting it', fakeAsync(() => {
    loadInFakeZone();

    const row = takePending((r) => r.capacityOk);
    if (!row) return pending('no capacity-clean pending suggestion');

    // Someone else touched the record after this screen read it.
    db.putaway.find((p) => p.id === row.id)!.version += 1;

    component.accept(row);
    tick(1000);
    fixture.detectChanges();

    expect(db.putaway.find((p) => p.id === row.id)!.accepted).toBe(false);
    expect(notifications.notifications()[0].kind).toBe('error');
  }));

  it('raises an exception when a scanned barcode matches no suggestion', fakeAsync(() => {
    loadInFakeZone();

    component.onLocationScanned('YOK-9999');
    tick(1000);

    expect(notifications.notifications()[0].kind).toBe('error');
    expect(audit.events()[0].actionType).toBe('Putaway Barcode Mismatch');
  }));
});
