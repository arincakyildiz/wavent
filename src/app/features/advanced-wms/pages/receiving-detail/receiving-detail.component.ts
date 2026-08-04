import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { describeError } from '../../../../core/api/api-error';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { AsnRow, ReceiptLineRow, ReceivingService } from '../../data-access/receiving.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-receiving-detail',
  imports: [IconComponent],
  templateUrl: './receiving-detail.component.html',
  styleUrl: './receiving-detail.component.scss',
})
export class ReceivingDetailComponent {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receivingService = inject(ReceivingService);

  readonly state = signal<LoadState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly asn = signal<AsnRow | undefined>(undefined);
  readonly lines = signal<ReceiptLineRow[]>([]);

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

    this.receivingService.getById(this.id).subscribe({
      next: (asn) => {
        this.asn.set(asn);
        this.receivingService.getLines(this.id).subscribe((lines) => this.lines.set(lines));
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
