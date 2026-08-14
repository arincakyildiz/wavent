import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { WarehouseScopeService } from '../../../../core/state/warehouse-scope.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryLedgerComponent } from '../../../../shared/components/inventory-ledger/inventory-ledger.component';
import { StockStatus } from '../../models/entities';
import {
  InventoryLotRow,
  InventoryRow,
  InventoryService,
  LedgerEntry,
} from '../../data-access/inventory.service';
import { stockIsBalanced } from '../../data-access/selectors';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { forkJoin } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NotificationService } from '../../../../core/observability/notification.service';
import { AuditService } from '../../../../core/observability/audit.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { MAX_STOCK_QUANTITY } from '../../../../shared/validators/wms-validators';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-inventory-detail',
  imports: [IconComponent, InventoryLedgerComponent, ReactiveFormsModule, HasPermissionDirective],
  templateUrl: './inventory-detail.component.html',
  styleUrl: './inventory-detail.component.scss',
})
export class InventoryDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly scope = inject(WarehouseScopeService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly sku = signal('');
  readonly item = signal<InventoryRow | undefined>(undefined);
  readonly lots = signal<InventoryLotRow[]>([]);
  readonly ledger = signal<LedgerEntry[]>([]);
  readonly activeLot = signal<InventoryLotRow | null>(null);
  readonly saving = signal(false);
  readonly stockStatuses = Object.values(StockStatus);
  readonly adjustmentForm = new FormGroup({
    quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(MAX_STOCK_QUANTITY)] }),
    status: new FormControl<StockStatus>(StockStatus.Available, { nonNullable: true, validators: [Validators.required] }),
  });

  /** Surfaces the on-hand = sum(buckets) invariant instead of assuming it. */
  readonly balanced = computed(() => {
    const item = this.item();
    return item ? stockIsBalanced(item) : true;
  });

  constructor() {
    const sku = this.route.snapshot.paramMap.get('sku') ?? '';
    this.sku.set(sku);
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    const scope = this.scope.activeCodes();

    forkJoin({
      item: this.inventoryService.getBySku(this.sku(), scope),
      lots: this.inventoryService.getLots(this.sku(), scope),
      ledger: this.inventoryService.getLedger(this.sku(), scope),
    }).subscribe({
      next: ({ item, lots, ledger }) => {
        this.item.set(item);
        this.lots.set(lots);
        this.ledger.set(ledger);
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  back(): void {
    this.router.navigate(['/wms/inventory']);
  }

  /** The browser's own print pipeline is the PDF export — "Save as PDF" in the print dialog. */
  downloadPdf(): void {
    window.print();
  }

  editBalance(row: InventoryLotRow): void {
    this.activeLot.set(row);
    this.adjustmentForm.setValue({ quantity: row.quantity, status: row.status });
  }

  saveAdjustment(): void {
    const row = this.activeLot();
    if (!row || this.adjustmentForm.invalid) return;
    const value = this.adjustmentForm.getRawValue();
    this.confirm.ask({
      title: this.i18n.t('inventoryDetail.adjustTitle', { lot: row.lot }),
      message: this.i18n.t('inventoryDetail.adjustMessage', { quantity: value.quantity, status: this.i18n.t('st.' + value.status) }),
      confirmLabel: this.i18n.t('inventoryDetail.adjustConfirm'),
      tone: 'danger',
      requireReason: true,
      reasonLabel: this.i18n.t('inventoryDetail.adjustReason'),
    }).subscribe((result) => {
      if (!result.confirmed) return;
      this.saving.set(true);
      this.inventoryService.adjustBalance(row.id, row.version, value.quantity, value.status, result.reason ?? '').subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.activeLot.set(null);
          this.audit.record({
            actionType: 'Inventory Adjusted',
            targetType: 'InventoryBalance',
            targetId: row.id,
            oldValue: `${row.quantity} · ${row.status}`,
            newValue: `${updated.quantity} · ${updated.status}`,
            reason: result.reason,
          });
          this.notifications.success(this.i18n.t('inventoryDetail.adjustedToast'), row.lot);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.notifications.error(this.i18n.t('inventoryDetail.adjustFailed'), describeError(err), () => this.load());
        },
      });
    });
  }

  statusTone(status: StockStatus): string {
    const tone: Record<StockStatus, string> = {
      [StockStatus.Available]: 'tone-success',
      [StockStatus.Reserved]: 'tone-info',
      [StockStatus.Quarantine]: 'tone-warning',
      [StockStatus.Damaged]: 'tone-danger',
      [StockStatus.Blocked]: 'tone-danger',
    };
    return tone[status];
  }
}
