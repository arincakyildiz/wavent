import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { ApiError } from '../../../core/api/api-error';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { ExceptionRec, db } from './mock-data';
import { translate } from '../../../core/i18n/i18n.service';

export type ExceptionRow = ExceptionRec;

/** A record that corroborates the exception, gathered from the entities it references. */
export interface ExceptionEvidence {
  label: string;
  value: string;
  hint?: string;
}

/** Everyone an exception may be reassigned to. */
export const EXCEPTION_OWNERS = [
  'Murat Çelik',
  'Ayşe Kaya',
  'Mehmet Yılmaz',
  'Zeynep Aydın',
  'Can Öztürk',
  'Elif Demir',
];

const ACCESSOR = (row: ExceptionRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

@Injectable({ providedIn: 'root' })
export class ExceptionsService {
  private readonly api = inject(MockApiService);

  query(scope: string[], query: ListQuery): Observable<ListResult<ExceptionRow>> {
    const source = db.exceptions.filter((e) => !scope.length || scope.includes(e.warehouseCode));

    return this.api.simulate(source, { delayMs: 320 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.type, r.referenceId, r.owner ?? '', r.referenceType],
        }),
      ),
    );
  }

  totals(scope: string[]): Observable<{ open: number; investigating: number; resolved: number; critical: number }> {
    const rows = db.exceptions.filter((e) => !scope.length || scope.includes(e.warehouseCode));
    return this.api.simulate(
      {
        open: rows.filter((r) => r.status === 'open').length,
        investigating: rows.filter((r) => r.status === 'investigating').length,
        resolved: rows.filter((r) => r.status === 'resolved').length,
        critical: rows.filter((r) => r.severity === 'critical' && r.status !== 'resolved').length,
      },
      { delayMs: 200 },
    );
  }

  resolve(id: string, expectedVersion: number, note: string): Observable<ExceptionRow> {
    return this.api.simulate(id, { delayMs: 460, kind: 'write' }).pipe(
      map(() => {
        const record = db.exceptions.find((e) => e.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.exceptionNotFound'));

        this.api.assertVersion(expectedVersion, record.version);

        if (record.status === 'resolved') {
          throw new ApiError('validation', translate('svc.exceptionResolved'));
        }
        if (note.trim().length < 6) {
          throw new ApiError('validation', translate('svc.resolutionTooShort'));
        }

        record.status = 'resolved';
        record.resolutionNote = note.trim();
        record.version += 1;
        return { ...record };
      }),
    );
  }

  /**
   * Evidence backing an exception, joined from whatever it references. This is what
   * turns "short pick on PK-2702" into a reviewable case rather than a bare label.
   */
  evidence(id: string): Observable<ExceptionEvidence[]> {
    const record = db.exceptions.find((e) => e.id === id);
    if (!record) return this.api.simulate<ExceptionEvidence[]>([], { delayMs: 200 });

    const out: ExceptionEvidence[] = [
      { label: translate('evidence.reference'), value: `${record.referenceType} · ${record.referenceId}` },
      { label: translate('evidence.openedAt'), value: record.createdAt },
      { label: translate('common.warehouse'), value: record.warehouseCode },
    ];

    const task = db.pickTasks.find((t) => t.code === record.referenceId);
    if (task) {
      out.push(
        {
          label: translate('evidence.taskProgress'),
          value: translate('evidence.lines', { picked: task.pickedLines, total: task.lineCount }),
        },
        {
          label: translate('evidence.route'),
          value: task.route.join(' → '),
          hint: translate('evidence.stops', { count: task.route.length }),
        },
        {
          label: translate('evidence.assignedOperator'),
          value: task.assignedTo ?? translate('evidence.unassigned'),
        },
      );
    }

    const pkg = db.packages.find((p) => p.code === record.referenceId);
    if (pkg) {
      out.push(
        {
          label: translate('evidence.packageWeight'),
          value: `${pkg.weightKg} kg`,
          hint: translate('evidence.expectedWeight', { weight: pkg.expectedWeightKg }),
        },
        {
          label: translate('evidence.contentCheck'),
          value: translate(pkg.contentVerified ? 'evidence.done' : 'common.pending'),
        },
      );
    }

    const movement = db.movements.find((m) => m.reasonCode === record.referenceId);
    if (movement) {
      out.push({
        label: translate('evidence.lastMovement'),
        value: `${movement.type} · ${movement.quantity}`,
        hint: movement.at,
      });
    }

    return this.api.simulate(out, { delayMs: 280 });
  }

  /** Hands an exception to another owner; version-guarded like every other write. */
  reassign(id: string, expectedVersion: number, owner: string): Observable<ExceptionRow> {
    return this.api.simulate(id, { delayMs: 420, kind: 'write' }).pipe(
      map(() => {
        const record = db.exceptions.find((e) => e.id === id);
        if (!record) throw new ApiError('not-found', translate('svc.exceptionNotFound'));

        this.api.assertVersion(expectedVersion, record.version);

        if (record.status === 'resolved') {
          throw new ApiError('validation', translate('svc.resolvedCannotReassign'));
        }
        if (!EXCEPTION_OWNERS.includes(owner)) {
          throw new ApiError('validation', translate('svc.invalidOperator'));
        }

        record.owner = owner;
        // Handing it over means someone is now actively on it.
        if (record.status === 'open') record.status = 'investigating';
        record.version += 1;

        return { ...record };
      }),
    );
  }
}
