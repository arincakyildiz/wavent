import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { AsnRow, ReceiptLineRow, ReceivingService } from '../../data-access/receiving.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { forkJoin } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NotificationService } from '../../../../core/observability/notification.service';
import { AuditService } from '../../../../core/observability/audit.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-receiving-detail',
  imports: [IconComponent, ReactiveFormsModule, HasPermissionDirective],
  templateUrl: './receiving-detail.component.html',
  styleUrl: './receiving-detail.component.scss',
})
export class ReceivingDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receivingService = inject(ReceivingService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly asn = signal<AsnRow | undefined>(undefined);
  readonly lines = signal<ReceiptLineRow[]>([]);
  readonly activeLine = signal<ReceiptLineRow | null>(null);
  readonly saving = signal(false);
  readonly receiptForm = new FormGroup({
    receivedQuantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    damagedQuantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    quarantine: new FormControl(false, { nonNullable: true }),
  });

  readonly expectedTotal = computed(() => this.lines().reduce((s, l) => s + l.expectedQuantity, 0));
  readonly receivedTotal = computed(() => this.lines().reduce((s, l) => s + l.receivedQuantity, 0));
  readonly damagedTotal = computed(() => this.lines().reduce((s, l) => s + l.damagedQuantity, 0));

  private id = '';

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);

    forkJoin({
      asn: this.receivingService.getById(this.id),
      lines: this.receivingService.getLines(this.id),
    }).subscribe({
      next: ({ asn, lines }) => {
        this.asn.set(asn);
        this.lines.set(lines);
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  back(): void {
    this.router.navigate(['/wms/receiving']);
  }

  /** The browser's own print pipeline is the PDF export — "Save as PDF" in the print dialog. */
  downloadPdf(): void {
    window.print();
  }

  editLine(line: ReceiptLineRow): void {
    this.activeLine.set(line);
    this.receiptForm.setValue({
      receivedQuantity: line.receivedQuantity,
      damagedQuantity: line.damagedQuantity,
      quarantine: line.status === 'quarantined',
    });
  }

  saveReceipt(): void {
    const line = this.activeLine();
    if (!line || this.receiptForm.invalid) return;
    this.saving.set(true);
    const value = this.receiptForm.getRawValue();
    this.receivingService.receiveLine(line.id, line.version, value).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.activeLine.set(null);
        this.lines.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
        this.audit.record({
          actionType: 'Receipt Line Processed',
          targetType: 'ReceiptLine',
          targetId: updated.id,
          oldValue: `${line.receivedQuantity}/${line.damagedQuantity}`,
          newValue: `${updated.receivedQuantity}/${updated.damagedQuantity} · ${updated.status}`,
        });
        this.notifications.success(this.i18n.t('receivingDetail.saved'), updated.skuCode);
      },
      error: (err) => {
        this.saving.set(false);
        this.notifications.error(this.i18n.t('receivingDetail.saveFailed'), describeError(err), () => this.load());
      },
    });
  }

  lineTone(status: ReceiptLineRow['status']): string {
    const tone: Record<ReceiptLineRow['status'], string> = {
      pending: 'tone-neutral',
      matched: 'tone-success',
      short: 'tone-warning',
      over: 'tone-info',
      damaged: 'tone-danger',
      quarantined: 'tone-danger',
    };
    return tone[status];
  }
}
