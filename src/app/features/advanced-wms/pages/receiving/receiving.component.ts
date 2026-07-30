import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AsnRow, ReceivingService } from '../../data-access/receiving.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-receiving',
  imports: [],
  templateUrl: './receiving.component.html',
  styleUrl: './receiving.component.scss',
})
export class ReceivingComponent {
  private readonly receivingService = inject(ReceivingService);
  private readonly router = inject(Router);

  readonly state = signal<LoadState>('loading');
  readonly asns = signal<AsnRow[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.receivingService.list().subscribe({
      next: (rows) => {
        this.asns.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  open(id: string): void {
    this.router.navigate(['/wms/receiving', id]);
  }

  statusTone(status: AsnRow['status']): string {
    const tone: Record<AsnRow['status'], string> = {
      expected: 'tone-neutral',
      arrived: 'tone-info',
      receiving: 'tone-warning',
      closed: 'tone-success',
      cancelled: 'tone-danger',
    };
    return tone[status];
  }
}
