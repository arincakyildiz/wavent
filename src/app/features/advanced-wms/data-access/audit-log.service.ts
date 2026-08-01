import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { AuditService } from '../../../core/observability/audit.service';
import { ListQuery, ListResult, runQuery } from '../../../shared/utils/list-query';
import { db } from './mock-data';

export interface AuditEventRow {
  id: string;
  date: string;
  actor: string;
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  /** Distinguishes actions taken in this session from the seeded history. */
  live: boolean;
}

const ACCESSOR = (row: AuditEventRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly api = inject(MockApiService);
  private readonly audit = inject(AuditService);

  /**
   * Merges the seeded trail with events recorded during this session, so an operator
   * sees the consequences of their own actions in the log.
   */
  query(query: ListQuery): Observable<ListResult<AuditEventRow>> {
    const live: AuditEventRow[] = this.audit.events().map((e) => ({
      id: e.id,
      date: `${e.at.getFullYear()}-${pad(e.at.getMonth() + 1)}-${pad(e.at.getDate())} ${pad(e.at.getHours())}:${pad(e.at.getMinutes())}`,
      actor: e.actor,
      actionType: e.actionType,
      targetType: e.targetType,
      targetId: e.targetId,
      oldValue: e.oldValue,
      newValue: e.newValue,
      reason: e.reason,
      live: true,
    }));

    const seeded: AuditEventRow[] = db.auditEvents.map((e) => ({
      id: e.id,
      date: e.at,
      actor: e.actor,
      actionType: e.actionType,
      targetType: e.targetType,
      targetId: e.targetId,
      oldValue: e.oldValue,
      newValue: e.newValue,
      live: false,
    }));

    const merged = [...live, ...seeded];

    return this.api.simulate(merged, { delayMs: 300 }).pipe(
      map((rows) =>
        runQuery(rows, query, {
          accessor: ACCESSOR,
          searchable: (r) => [r.actor, r.actionType, r.targetId, r.targetType],
        }),
      ),
    );
  }
}
