import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ReleaseResult, WaveOrderCandidate, WaveOrderStatus, WaveRow, WavesService } from '../../data-access/waves.service';
import { WavePlanningStore } from '../../state/wave-planning.store';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { codePattern, SALES_ORDER_NUMBER_PATTERN } from '../../../../shared/validators/wms-validators';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-wave-detail',
  imports: [IconComponent, HasPermissionDirective, ReactiveFormsModule],
  templateUrl: './wave-detail.component.html',
  styleUrl: './wave-detail.component.scss',
})
export class WaveDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly wavesService = inject(WavesService);
  private readonly notifications = inject(NotificationService);
  private readonly audit = inject(AuditService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly store = inject(WavePlanningStore);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly wave = signal<WaveRow | undefined>(undefined);
  readonly orders = signal<WaveOrderStatus[]>([]);
  readonly releasing = signal(false);
  readonly editing = signal(false);
  readonly candidates = signal<WaveOrderCandidate[]>([]);
  readonly orderForm = new FormGroup({
    orderNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, codePattern(SALES_ORDER_NUMBER_PATTERN)] }),
  });
  /** Per-order outcome of the last publish attempt (§11 partial result). */
  readonly lastRelease = signal<ReleaseResult | null>(null);

  readonly riskyCount = computed(() => this.orders().filter((o) => o.status !== 'ok').length);
  readonly shortageCount = computed(() => this.orders().filter((o) => o.status === 'stock-shortage').length);
  readonly canRelease = computed(() => {
    const w = this.wave();
    return !!w && (w.status === 'planned' || w.status === 'draft');
  });

  private id = '';

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set(null);

    // Served from the store on a list → detail hop, fetched on a cold deep-link.
    this.store.loadWave(this.id).subscribe({
      next: (wave) => {
        this.wave.set(wave);
        this.wavesService.getOrders(this.id).subscribe((orders) => this.orders.set(orders));
        this.loadCandidates();
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
  }

  addOrder(): void {
    const wave = this.wave();
    if (!wave || this.orderForm.invalid) return;
    const orderNumber = this.orderForm.getRawValue().orderNumber;
    if (wave.status === 'released') {
      this.confirm.ask({
        title: this.i18n.t('waveDetail.addReleasedTitle'),
        message: this.i18n.t('waveDetail.addReleasedMessage', { order: orderNumber }),
        confirmLabel: this.i18n.t('waveDetail.addOrder'),
        requireReason: true,
        reasonLabel: this.i18n.t('waveDetail.changeReason'),
      }).subscribe((result) => {
        if (result.confirmed) this.commitOrderChange('add', orderNumber, result.reason);
      });
      return;
    }
    this.commitOrderChange('add', orderNumber);
  }

  removeOrder(orderNumber: string): void {
    const wave = this.wave();
    if (!wave) return;
    this.confirm.ask({
      title: this.i18n.t('waveDetail.removeTitle', { order: orderNumber }),
      message: this.i18n.t('waveDetail.removeMessage'),
      confirmLabel: this.i18n.t('waveDetail.removeOrder'),
      tone: 'danger',
      requireReason: wave.status === 'released',
      reasonLabel: this.i18n.t('waveDetail.changeReason'),
    }).subscribe((result) => {
      if (result.confirmed) this.commitOrderChange('remove', orderNumber, result.reason);
    });
  }

  private commitOrderChange(kind: 'add' | 'remove', orderNumber: string, reason?: string): void {
    const wave = this.wave();
    if (!wave) return;
    this.editing.set(true);
    const request = kind === 'add'
      ? this.wavesService.addOrder(wave.id, wave.version, orderNumber, reason)
      : this.wavesService.removeOrder(wave.id, wave.version, orderNumber, reason);
    request.subscribe({
      next: (updated) => {
        this.editing.set(false);
        this.wave.set(updated);
        this.store.upsert(updated);
        this.orderForm.reset({ orderNumber: '' });
        this.audit.record({
          actionType: kind === 'add' ? 'Order Added To Wave' : 'Order Removed From Wave',
          targetType: 'Wave',
          targetId: updated.name,
          oldValue: wave.orderCount,
          newValue: updated.orderCount,
          reason,
        });
        this.notifications.success(
          this.i18n.t(kind === 'add' ? 'waveDetail.orderAdded' : 'waveDetail.orderRemoved'),
          orderNumber,
        );
        this.wavesService.getOrders(this.id).subscribe((orders) => this.orders.set(orders));
        this.loadCandidates();
      },
      error: (err) => {
        this.editing.set(false);
        this.notifications.error(this.i18n.t('waveDetail.changeFailed'), describeError(err), () => this.load());
      },
    });
  }

  private loadCandidates(): void {
    this.wavesService.eligibleOrders(this.id).subscribe((rows) => this.candidates.set(rows));
  }

  back(): void {
    this.router.navigate(['/wms/waves']);
  }

  /** The browser's own print pipeline is the PDF export — "Save as PDF" in the print dialog. */
  downloadPdf(): void {
    window.print();
  }

  /** Publishing is irreversible for the orders it moves, so it always confirms first. */
  releaseWave(): void {
    const wave = this.wave();
    if (!wave || !this.canRelease()) return;

    const shortages = this.shortageCount();
    this.confirm
      .ask({
        title: this.i18n.t('waveDetail.releaseTitle', { name: wave.name }),
        message: shortages
          ? this.i18n.t('waveDetail.releasePartialMessage', { total: wave.orderCount, short: shortages })
          : this.i18n.t('waveDetail.releaseMessage', { total: wave.orderCount }),
        confirmLabel: this.i18n.t('waveDetail.releaseConfirm'),
        tone: shortages ? 'danger' : 'default',
        // A publish that knowingly leaves orders behind needs a recorded justification.
        requireReason: shortages > 0,
        reasonLabel: this.i18n.t('waveDetail.partialReason'),
      })
      .subscribe((result) => {
        if (result.confirmed) this.commitRelease(wave, result.reason);
      });
  }

  private commitRelease(wave: WaveRow, reason?: string): void {
    this.releasing.set(true);

    this.wavesService.release(this.id, wave.version).subscribe({
      next: (result) => {
        this.releasing.set(false);
        this.wave.set(result.wave);
        // Keep the store in step, or a later visit would serve the pre-release version.
        this.store.upsert(result.wave);
        this.lastRelease.set(result);

        this.audit.record({
          actionType: 'Wave Released',
          targetType: 'Wave',
          targetId: wave.name,
          oldValue: wave.status,
          newValue: `released (${result.released.length}/${wave.orderCount})`,
          reason,
        });

        if (result.failed.length) {
          this.notifications.warning(
            this.i18n.t('waveDetail.partialToast'),
            this.i18n.t('waveDetail.partialBody', {
          released: result.released.length,
          failed: result.failed.length,
        }),
          );
        } else {
          this.notifications.success(
        this.i18n.t('waveDetail.releasedToast'),
        this.i18n.t('waveDetail.releasedBody', { count: result.released.length }),
      );
        }

        this.wavesService.getOrders(this.id).subscribe((orders) => this.orders.set(orders));
      },
      error: (err) => {
        this.releasing.set(false);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? this.i18n.t('waveDetail.waveChanged') : this.i18n.t('waveDetail.releaseFailed'),
          describeError(err),
          () => this.load(),
        );
        if (conflict) this.load();
      },
    });
  }

  orderTone(status: WaveOrderStatus['status']): string {
    const tone: Record<WaveOrderStatus['status'], string> = {
      ok: 'tone-success',
      'capacity-risk': 'tone-warning',
      'stock-shortage': 'tone-danger',
    };
    return tone[status];
  }

  statusTone(status: WaveRow['status']): string {
    const tone: Record<WaveRow['status'], string> = {
      draft: 'tone-neutral',
      planned: 'tone-info',
      released: 'tone-warning',
      completed: 'tone-success',
      cancelled: 'tone-danger',
    };
    return tone[status];
  }
}
