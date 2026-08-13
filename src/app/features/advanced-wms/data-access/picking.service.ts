import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { PickTaskRec, db } from './mock-data';
import { ApiError } from '../../../core/api/api-error';
import { translate } from '../../../core/i18n/i18n.service';
import { ExceptionType } from '../models/entities';
import { DbPersistenceService } from './db-persistence.service';

export const PICK_OPERATORS = ['Murat Çelik', 'Ayşe Kaya', 'Mehmet Yılmaz', 'Zeynep Aydın', 'Can Öztürk', 'Elif Demir'];

export interface PickTaskRow extends PickTaskRec {
  locationCount: number;
  progressPct: number;
}

function toRow(t: PickTaskRec): PickTaskRow {
  return {
    ...t,
    locationCount: t.route.length,
    progressPct: t.lineCount ? Math.round((t.pickedLines / t.lineCount) * 100) : 0,
  };
}

const ACCESSOR = (row: PickTaskRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class PickingService {
  private readonly api = inject(MockApiService);
  private readonly persistence = inject(DbPersistenceService);

  query(scope: string[], query: ListQuery): Observable<ListResult<PickTaskRow>> {
    const source = db.pickTasks
      .filter((t) => !scope.length || scope.includes(t.warehouseCode))
      .map(toRow);

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.code, r.waveName, r.assignedTo ?? '', r.type],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ total: number; exceptions: number; inProgress: number }> {
    const rows = db.pickTasks.filter((t) => !scope.length || scope.includes(t.warehouseCode));
    return this.api.simulate(
      {
        total: rows.length,
        exceptions: rows.filter((r) => r.status === 'exception').length,
        inProgress: rows.filter((r) => r.status === 'in-progress').length,
      },
      { delayMs: 200 },
    );
  }

  assign(id: string, expectedVersion: number, operator: string): Observable<PickTaskRow> {
    return this.api.simulate(id, { delayMs: 420, kind: 'write' }).pipe(
      map(() => {
        const task = this.findTask(id, expectedVersion);
        if (!PICK_OPERATORS.includes(operator)) throw new ApiError('validation', translate('svc.invalidOperator'));
        if (task.status === 'completed') throw new ApiError('validation', translate('svc.completedTaskLocked'));
        task.assignedTo = operator;
        if (task.status === 'pending') task.status = 'in-progress';
        task.version += 1;
        return toRow(task);
      }),
      this.persistence.afterWrite(),
    );
  }

  recordPick(id: string, expectedVersion: number, barcode: string, quantity: number): Observable<PickTaskRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const task = this.findTask(id, expectedVersion);
        if (task.status === 'completed') throw new ApiError('validation', translate('svc.completedTaskLocked'));
        if (barcode.trim().toUpperCase() !== task.expectedBarcode.toUpperCase()) {
          this.openException(task, 'wrong-barcode', 'seed.exception.wrongBarcode');
          throw new ApiError('validation', translate('svc.wrongPickBarcode', { expected: task.expectedBarcode }));
        }
        const remaining = task.reservedQuantity - task.pickedQuantity;
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > remaining) {
          throw new ApiError('validation', translate('svc.pickQuantityExceeded', { remaining }));
        }
        task.pickedQuantity += quantity;
        task.pickedLines = Math.min(task.lineCount, Math.ceil((task.pickedQuantity / task.reservedQuantity) * task.lineCount));
        task.status = task.pickedQuantity === task.reservedQuantity ? 'completed' : 'in-progress';
        task.exceptionReason = undefined;
        task.version += 1;
        return toRow(task);
      }),
      this.persistence.afterWrite(),
    );
  }

  reportException(
    id: string,
    expectedVersion: number,
    type: Extract<ExceptionType, 'short-pick' | 'damage'>,
    reason: string,
  ): Observable<PickTaskRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const task = this.findTask(id, expectedVersion);
        if (reason.trim().length < 6) throw new ApiError('validation', translate('svc.reasonTooShort'));
        this.openException(task, type, type === 'damage' ? 'seed.exception.damaged' : 'seed.exception.shortPick');
        return toRow(task);
      }),
      this.persistence.afterWrite(),
    );
  }

  private findTask(id: string, expectedVersion: number): PickTaskRec {
    const task = db.pickTasks.find((record) => record.id === id);
    if (!task) throw new ApiError('not-found', translate('svc.pickTaskNotFound'));
    this.api.assertVersion(expectedVersion, task.version);
    return task;
  }

  private openException(task: PickTaskRec, type: ExceptionType, reason: string): void {
    task.status = 'exception';
    task.exceptionReason = reason;
    task.version += 1;
    db.exceptions.unshift({
      id: `ex-live-${db.exceptions.length + 1}`,
      type,
      severity: type === 'damage' ? 'high' : 'medium',
      warehouseCode: task.warehouseCode,
      referenceType: 'PickTask',
      referenceId: task.code,
      status: 'open',
      createdAt: new Date().toISOString(),
      version: 1,
    });
    // Wrong-barcode intentionally returns a validation error after opening the case,
    // so persist here instead of relying only on the successful-write operator.
    this.persistence.persist();
  }
}
