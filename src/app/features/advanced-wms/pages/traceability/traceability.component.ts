import { Component, inject, signal } from '@angular/core';
import { TraceabilityTimelineComponent } from '../../../../shared/components/traceability-timeline/traceability-timeline.component';
import { TraceabilityService, TraceEvent } from '../../data-access/traceability.service';
import { I18nService } from '../../../../core/i18n/i18n.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-traceability',
  imports: [TraceabilityTimelineComponent],
  templateUrl: './traceability.component.html',
  styleUrl: './traceability.component.scss',
})
export class TraceabilityComponent {
  readonly i18n = inject(I18nService);
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
}
