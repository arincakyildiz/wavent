import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError, isApiError } from '../../../../core/api/api-error';
import { AuditService } from '../../../../core/observability/audit.service';
import { NotificationService } from '../../../../core/observability/notification.service';
import { ConfirmDialogService } from '../../../../core/state/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ReleaseResult, WaveOrderStatus, WaveRow, WavesService } from '../../data-access/waves.service';
import { WavePlanningStore } from '../../state/wave-planning.store';
import { I18nService } from '../../../../core/i18n/i18n.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-wave-detail',
  imports: [IconComponent, HasPermissionDirective],
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
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(describeError(err));
        this.state.set('error');
      },
    });
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
        title: `${wave.name} yayınlansın mı?`,
        message: shortages
          ? `${wave.orderCount} siparişten ${shortages} tanesi stok yetersizliği nedeniyle dalgada kalacak. Kalanlar toplamaya açılır.`
          : `${wave.orderCount} sipariş toplamaya açılacak. Yayınlanan dalga doğrudan değiştirilemez.`,
        confirmLabel: 'Dalgayı yayınla',
        tone: shortages ? 'danger' : 'default',
        // A publish that knowingly leaves orders behind needs a recorded justification.
        requireReason: shortages > 0,
        reasonLabel: 'Kısmi yayın gerekçesi',
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
            'Dalga kısmi yayınlandı',
            `${result.released.length} sipariş açıldı, ${result.failed.length} sipariş stok nedeniyle kaldı.`,
          );
        } else {
          this.notifications.success('Dalga yayınlandı', `${result.released.length} sipariş toplamaya açıldı.`);
        }

        this.wavesService.getOrders(this.id).subscribe((orders) => this.orders.set(orders));
      },
      error: (err) => {
        this.releasing.set(false);
        const conflict = isApiError(err) && err.kind === 'conflict';
        this.notifications.error(
          conflict ? 'Dalga değişmiş' : 'Dalga yayınlanamadı',
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
