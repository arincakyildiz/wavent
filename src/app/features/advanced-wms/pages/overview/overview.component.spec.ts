import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FaultInjectionService } from '../../../../core/api/fault-injection.service';
import { IndexedDbService } from '../../../../core/storage/indexed-db.service';
import { OverviewComponent } from './overview.component';

/**
 * §13 offline/cache: when the dashboard call fails, the last good snapshot is served
 * from IndexedDB — but only ever *labelled as stale*, never presented as live.
 *
 * Real timers + whenStable() rather than fakeAsync: the flow crosses IndexedDB, whose
 * async work is not on Zone's fake clock.
 */
describe('OverviewComponent — offline snapshot fallback', () => {
  let fixture: ComponentFixture<OverviewComponent>;
  let component: OverviewComponent;
  let faults: FaultInjectionService;
  let db: IndexedDbService;

  // Each settle() waits out a 400ms service call; the recovery spec does three.
  let defaultTimeout: number;
  beforeAll(() => {
    defaultTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20_000;
  });
  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = defaultTimeout;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    faults = TestBed.inject(FaultInjectionService);
    db = TestBed.inject(IndexedDbService);
    faults.reset();
    await firstValueFrom(db.clear());

    fixture = TestBed.createComponent(OverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    faults.reset();
    await firstValueFrom(db.clear());
  });

  /**
   * Waits for the in-flight dashboard call (400ms simulated latency) plus the
   * IndexedDB read/write that follows it. Polls rather than sleeping a fixed span so
   * the specs stay quick when the work finishes early.
   */
  async function settle(): Promise<void> {
    // A fixed wait comfortably past the 400ms service latency, then extra turns for
    // the IndexedDB read/write that follows. Polling on summary()/errorMessage()
    // would short-circuit on the *previous* result after a reload().
    for (let i = 0; i < 16; i++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    fixture.detectChanges();
  }

  it('loads live data and reports no stale marker', async () => {
    await settle();

    expect(component.summary()).not.toBeNull();
    expect(component.errorMessage()).toBeNull();
    expect(component.staleSince()).toBeNull();
  });

  it('writes the successful snapshot to the offline cache', async () => {
    await settle();

    const keys = component.summary() ? 1 : 0;
    expect(keys).toBe(1);

    // The cache is keyed per scope+period; whichever one this run used must be present.
    const cached = await firstValueFrom(
      db.read('dashboard:NYC-01,AMS-01,IST-01,DXB-01,GRU-01:today'),
    );
    expect(cached).not.toBeNull();
  });

  it('serves the cached snapshot when the live call fails, marked as stale', async () => {
    await settle();
    const live = component.summary();
    expect(live).not.toBeNull();

    // Force the retry to fail, then re-issue the request.
    faults.armNextFailure('network');
    component.reload();
    await settle();

    // Figures still on screen…
    expect(component.summary()).not.toBeNull();
    // …but the failure is surfaced, not swallowed…
    expect(component.errorMessage()).toBeTruthy();
    // …and the data is explicitly labelled as a snapshot.
    expect(component.staleSince()).not.toBeNull();
  });

  it('shows a plain error when the call fails and nothing is cached', async () => {
    await firstValueFrom(db.clear());

    faults.armNextFailure('network');
    component.reload();
    await settle();

    expect(component.summary()).toBeNull();
    expect(component.errorMessage()).toBeTruthy();
    expect(component.staleSince()).toBeNull();
  });

  it('clears the stale marker once a live call succeeds again', async () => {
    await settle();

    faults.armNextFailure('network');
    component.reload();
    await settle();
    expect(component.staleSince()).not.toBeNull();

    // Recovery: the next call goes through.
    component.reload();
    await settle();

    expect(component.staleSince()).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });
});
