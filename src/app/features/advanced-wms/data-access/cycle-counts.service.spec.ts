import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { db } from './mock-data';
import { CycleCountsService } from './cycle-counts.service';

describe('CycleCountsService workflow', () => {
  it('requires a second count above threshold and closes on the second entry', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(CycleCountsService);
    TestBed.inject(FaultInjectionService).reset();
    const record = db.cycleCounts.find((row) => row.status !== 'closed');
    if (!record) return pending('no open cycle count');
    const snapshot = { ...record };
    const movementCount = db.movements.length;
    const variance = Math.max(10, Math.ceil(record.expectedQuantity * 0.1));

    const first = await firstValueFrom(service.recordCount(record.id, record.version, record.expectedQuantity - variance));
    expect(first.status).toBe('variance-review');
    expect(first.countAttempts).toBe(1);
    const second = await firstValueFrom(service.recordCount(record.id, first.version, record.expectedQuantity - variance));
    expect(second.status).toBe('closed');
    expect(second.countAttempts).toBe(2);

    Object.assign(record, snapshot);
    db.movements.splice(0, db.movements.length - movementCount);
  });
});
