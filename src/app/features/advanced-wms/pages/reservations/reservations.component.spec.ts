import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FaultInjectionService } from '../../../../core/api/fault-injection.service';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { AllocationRec, db } from '../../data-access/mock-data';
import { LotCandidate, ReservationRow } from '../../data-access/reservations.service';
import { ReservationsComponent } from './reservations.component';

/**
 * Integration test for the fourth main flow: manually re-allocating a reservation
 * to another lot. It is the one flow where a *quantity* conflict is possible on top
 * of the usual version conflict, and where breaking FEFO must force a justification.
 */
describe('ReservationsComponent — lot override flow', () => {
  let fixture: ComponentFixture<ReservationsComponent>;
  let component: ReservationsComponent;
  let confirm: ConfirmDialogService;
  let audit: AuditService;
  let notifications: NotificationService;
  let faults: FaultInjectionService;

  const REASON = 'Müşteri daha yeni lot talep etti';
  let restore: (() => void) | null = null;
  let blocker: AllocationRec | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReservationsComponent);
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

    if (blocker) {
      const index = db.allocations.indexOf(blocker);
      if (index !== -1) db.allocations.splice(index, 1);
      blocker = null;
    }

    notifications.clear();
    faults.reset();
  });

  /** See the putaway spec: `reload()` only bumps a signal, so CD must run first. */
  function loadInFakeZone(): void {
    component.list.reload();
    fixture.detectChanges();
    tick(1000);
    fixture.detectChanges();
  }

  /** A reservation holding stock, remembering how to put the record back. */
  function takeMovable(): ReservationRow | null {
    const row = component.list.rows().find((r) => r.quantity > 0 && !r.isBackorder);
    if (!row) return null;
    return remember(row);
  }

  function remember(row: ReservationRow): ReservationRow {
    const record = db.allocations.find((a) => a.id === row.id)!;
    const snapshot = { ...record };
    restore = () => Object.assign(record, snapshot);
    return row;
  }

  /** Opens the breakdown panel and waits for its candidate list. */
  function openCandidates(row: ReservationRow): void {
    component.toggleCandidates(row);
    tick(1000);
    fixture.detectChanges();
  }

  /**
   * Not every reservation has somewhere to go — the alternative lot must exist *and*
   * still have enough free stock. Walks the page until one does, so these specs test
   * the override rather than skipping on whichever row happens to sort first.
   */
  function findMovableWithCandidate(): { row: ReservationRow; candidate: LotCandidate } | null {
    for (const row of component.list.rows()) {
      if (row.quantity <= 0 || row.isBackorder) continue;

      openCandidates(row);
      const candidate = component.candidates().find((c) => c.freeQuantity >= row.quantity);
      if (candidate) return { row: remember(row), candidate };
    }
    return null;
  }

  it('loads reservations into the list', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.list.rows().length).toBeGreaterThan(0);
    expect(component.list.error()).toBeNull();
  });

  it('loads alternative lots when a row is expanded', fakeAsync(() => {
    loadInFakeZone();

    const row = takeMovable();
    if (!row) return pending('no movable reservation');

    openCandidates(row);

    expect(component.activeRow()?.id).toBe(row.id);
    expect(component.candidatesLoading()).toBe(false);
  }));

  it('always asks for an override reason before moving a reservation', fakeAsync(() => {
    loadInFakeZone();

    const found = findMovableWithCandidate();
    if (!found) return pending('no reservation with a usable alternative lot');
    const { candidate } = found;

    const ask = spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));

    component.chooseCandidate(candidate);
    tick(1000);

    expect(ask).toHaveBeenCalled();
    // §10: re-allocating away from the engine's choice is always a judgement call.
    expect(ask.calls.mostRecent().args[0].requireReason).toBe(true);
  }));

  it('moves the reservation, records an audit event and notifies', fakeAsync(() => {
    loadInFakeZone();

    const found = findMovableWithCandidate();
    if (!found) return pending('no reservation with a usable alternative lot');
    const { row, candidate } = found;

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: REASON }));

    component.chooseCandidate(candidate);
    tick(1000);
    fixture.detectChanges();

    const record = db.allocations.find((a) => a.id === row.id)!;
    expect(record.lot).toBe(candidate.lot);
    expect(record.overrideReason).toBe(REASON);
    expect(record.version).toBe(row.version + 1);

    const recorded = audit.events()[0];
    expect(recorded.actionType).toBe('Reservation Overridden');
    expect(recorded.reason).toBe(REASON);

    expect(notifications.notifications()[0].kind).toBe('success');
  }));

  it('surfaces a quantity conflict when the target lot was consumed meanwhile', fakeAsync(() => {
    loadInFakeZone();

    const found = findMovableWithCandidate();
    if (!found) return pending('no reservation with a usable alternative lot');
    const { row, candidate } = found;

    // A competing reservation claims the target lot between read and write (§11).
    const source = db.allocations.find((a) => a.id === row.id)!;
    blocker = {
      ...source,
      id: 'al-spec-blocker',
      lot: candidate.lot,
      locationPath: candidate.locationPath,
      quantity: candidate.freeQuantity,
      version: 1,
    };
    db.allocations.push(blocker);

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: REASON }));

    component.chooseCandidate(candidate);
    tick(1000);
    fixture.detectChanges();

    // The stock must not be over-committed, and the operator must be told why.
    expect(source.lot).toBe(row.lot);
    expect(notifications.notifications()[0].kind).toBe('error');
  }));

  it('surfaces a stale version as a conflict', fakeAsync(() => {
    loadInFakeZone();

    const found = findMovableWithCandidate();
    if (!found) return pending('no reservation with a usable alternative lot');
    const { row, candidate } = found;

    // Someone else edited the allocation after this screen read it.
    const record = db.allocations.find((a) => a.id === row.id)!;
    record.version += 1;

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: REASON }));

    component.chooseCandidate(candidate);
    tick(1000);
    fixture.detectChanges();

    expect(record.lot).toBe(row.lot);
    expect(notifications.notifications()[0].kind).toBe('error');
  }));
});
