import { Component, inject, signal } from '@angular/core';
import { TraceabilityService, TraceEvent } from '../../data-access/traceability.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-traceability',
  imports: [],
  templateUrl: './traceability.component.html',
  styleUrl: './traceability.component.scss',
})
export class TraceabilityComponent {
  private readonly traceabilityService = inject(TraceabilityService);

  readonly state = signal<LoadState>('loading');
  readonly lots = signal<string[]>([]);
  readonly selectedLot = signal('');
  readonly events = signal<TraceEvent[]>([]);

  constructor() {
    this.state.set('loading');
    this.traceabilityService.listLots().subscribe({
      next: (lots) => {
        this.lots.set(lots);
        this.state.set('success');
        if (lots.length) this.selectLot(lots[0]);
      },
      error: () => this.state.set('error'),
    });
  }

  selectLot(lot: string): void {
    this.selectedLot.set(lot);
    this.traceabilityService.getTrace(lot).subscribe((events) => this.events.set(events));
  }

  stageTone(stage: TraceEvent['stage']): string {
    const tone: Record<TraceEvent['stage'], string> = {
      Receipt: 'tone-info',
      Putaway: 'tone-info',
      Reservation: 'tone-warning',
      Pick: 'tone-warning',
      Pack: 'tone-success',
      Shipment: 'tone-success',
    };
    return tone[stage];
  }
}
