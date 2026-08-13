import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { LocalStorageService } from '../storage/local-storage.service';

export interface AuditRecord {
  id: string;
  at: Date;
  actor: string;
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string;
  newValue?: string;
  /** Justification captured from a confirm dialog, when the rule demanded one. */
  reason?: string;
}

export interface AuditInput {
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  reason?: string;
}

let counter = 0;
const AUDIT_STORAGE_KEY = 'audit-live-v1';

function normalise(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/**
 * Append-only audit trail. Every rule-governed action (override, release, adjustment,
 * approval, creation) records here, and the Audit Log screen renders this plus the
 * seeded history — so what the user does in the session shows up in the trail.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(LocalStorageService);
  private readonly recorded = signal<AuditRecord[]>([]);

  readonly events = this.recorded.asReadonly();
  readonly sessionCount = computed(() => this.recorded().length);

  constructor() {
    const saved = this.storage.read<(Omit<AuditRecord, 'at'> & { at: string })[]>(AUDIT_STORAGE_KEY, []);
    this.recorded.set(
      saved
        .filter((record) => record && typeof record.id === 'string' && typeof record.at === 'string')
        .map((record) => ({ ...record, at: new Date(record.at) })),
    );
  }

  record(input: AuditInput): AuditRecord {
    const record: AuditRecord = {
      id: `ae-live-${++counter}`,
      at: new Date(),
      actor: this.auth.currentUser().name,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      oldValue: normalise(input.oldValue),
      newValue: normalise(input.newValue),
      reason: input.reason,
    };
    this.recorded.update((list) => [record, ...list]);
    this.storage.write(AUDIT_STORAGE_KEY, this.recorded());
    return record;
  }

  clear(): void {
    this.recorded.set([]);
    this.storage.remove(AUDIT_STORAGE_KEY);
  }
}
