import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { db } from '../../data-access/mock-data';
import { ExceptionsComponent } from './exceptions.component';

/**
 * Integration test for the "resolve an exception" flow, which is the template for
 * every rule-governed action in the app: confirm with a mandatory reason, call the
 * service, record an audit event and notify.
 */
describe('ExceptionsComponent — resolve flow', () => {
  let fixture: ComponentFixture<ExceptionsComponent>;
  let component: ExceptionsComponent;
  let confirm: ConfirmDialogService;
  let audit: AuditService;
  let notifications: NotificationService;

  const REASON = 'Barkod yeniden okutuldu ve kayıt düzeltildi';
  let restore: (() => void) | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExceptionsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExceptionsComponent);
    component = fixture.componentInstance;
    confirm = TestBed.inject(ConfirmDialogService);
    audit = TestBed.inject(AuditService);
    notifications = TestBed.inject(NotificationService);

    fixture.detectChanges();
  });

  afterEach(() => {
    restore?.();
    restore = null;
    notifications.clear();
  });

  /** Grabs an unresolved exception and remembers how to put it back. */
  function takeOpenException() {
    const record = db.exceptions.find((e) => e.status !== 'resolved');
    if (!record) return null;
    const snapshot = { status: record.status, version: record.version, note: record.resolutionNote };
    restore = () => {
      record.status = snapshot.status;
      record.version = snapshot.version;
      record.resolutionNote = snapshot.note;
    };
    return record;
  }

  function row(id: string) {
    return { ...db.exceptions.find((e) => e.id === id)! };
  }

  it('loads exceptions into the list', async () => {
    // Real timers + whenStable(), not fakeAsync: the request is issued by an effect
    // inside toObservable, and how many change-detection rounds it takes to flush
    // that effect is an Angular-zone implementation detail, not something this test
    // should have to model with a fixed tick() count.
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.list.rows().length).toBeGreaterThan(0);
    expect(component.list.error()).toBeNull();
  });

  it('does nothing when the operator cancels the confirmation', fakeAsync(() => {
    const record = takeOpenException();
    if (!record) {
      pending('no open exception in dataset');
      return;
    }

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));
    const auditBefore = audit.sessionCount();

    component.resolve(row(record.id));
    tick(1000);

    expect(record.status).not.toBe('resolved');
    expect(audit.sessionCount()).toBe(auditBefore);
  }));

  it('always asks for a written reason before resolving', fakeAsync(() => {
    const record = takeOpenException();
    if (!record) {
      pending('no open exception in dataset');
      return;
    }

    const ask = spyOn(confirm, 'ask').and.returnValue(of({ confirmed: false }));
    component.resolve(row(record.id));
    tick(1000);

    expect(ask).toHaveBeenCalled();
    expect(ask.calls.mostRecent().args[0].requireReason).toBe(true);
  }));

  it('resolves, records an audit event and notifies on confirmation', fakeAsync(() => {
    const record = takeOpenException();
    if (!record) {
      pending('no open exception in dataset');
      return;
    }

    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: REASON }));

    component.resolve(row(record.id));
    tick(1000);
    fixture.detectChanges();

    expect(record.status).toBe('resolved');
    expect(record.resolutionNote).toBe(REASON);

    const recorded = audit.events()[0];
    expect(recorded.actionType).toBe('Exception Resolved');
    expect(recorded.targetId).toBe(record.referenceId);
    // The justification must reach the audit trail, not just the record.
    expect(recorded.reason).toBe(REASON);

    expect(notifications.notifications()[0].kind).toBe('success');
  }));

  it('surfaces a rejected resolution as an error notification and leaves the record alone', fakeAsync(() => {
    const record = takeOpenException();
    if (!record) {
      pending('no open exception in dataset');
      return;
    }

    // Too short for the server-side rule, so the write must fail.
    spyOn(confirm, 'ask').and.returnValue(of({ confirmed: true, reason: 'kısa' }));

    component.resolve(row(record.id));
    tick(1000);
    fixture.detectChanges();

    expect(record.status).not.toBe('resolved');
    expect(notifications.notifications()[0].kind).toBe('error');
  }));
});
