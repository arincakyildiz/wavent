import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { db } from './mock-data';
import { PickingService } from './picking.service';

describe('PickingService workflows', () => {
  let service: PickingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PickingService);
    TestBed.inject(FaultInjectionService).reset();
  });

  it('rejects a pick above the reserved remainder', async () => {
    const task = db.pickTasks.find((row) => row.status !== 'completed');
    if (!task) return pending('no mutable pick task');
    const snapshot = { ...task };
    let error: unknown;
    try {
      await firstValueFrom(service.recordPick(task.id, task.version, task.expectedBarcode, task.reservedQuantity + 1));
    } catch (value) {
      error = value;
    }
    expect(isApiError(error) && error.kind).toBe('validation');
    Object.assign(task, snapshot);
  });

  it('opens a wrong-barcode exception and stops the task', async () => {
    const task = db.pickTasks.find((row) => row.status !== 'completed');
    if (!task) return pending('no mutable pick task');
    const snapshot = { ...task };
    const exceptionCount = db.exceptions.length;
    try {
      await firstValueFrom(service.recordPick(task.id, task.version, 'WRONG', 1));
      fail('expected wrong barcode validation');
    } catch (error) {
      expect(isApiError(error) && error.kind).toBe('validation');
      expect(task.status).toBe('exception');
      expect(db.exceptions[0].type).toBe('wrong-barcode');
    } finally {
      Object.assign(task, snapshot);
      db.exceptions.splice(0, db.exceptions.length - exceptionCount);
    }
  });
});
