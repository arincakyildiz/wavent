import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AsnRow, ReceiptLineRow, ReceivingService } from '../../data-access/receiving.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-receiving-detail',
  imports: [],
  templateUrl: './receiving-detail.component.html',
  styleUrl: './receiving-detail.component.scss',
})
export class ReceivingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receivingService = inject(ReceivingService);

  readonly state = signal<LoadState>('loading');
  readonly asn = signal<AsnRow | undefined>(undefined);
  readonly lines = signal<ReceiptLineRow[]>([]);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load(id);
  }

  load(id: string): void {
    this.state.set('loading');
    this.receivingService.getById(id).subscribe({
      next: (asn) => {
        if (!asn) {
          this.state.set('error');
          return;
        }
        this.asn.set(asn);
        this.receivingService.getLines(id).subscribe((lines) => this.lines.set(lines));
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  back(): void {
    this.router.navigate(['/wms/receiving']);
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
