import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * §9 TraceabilityTimeline — follows a lot/serial from receipt through to shipment.
 * Presentational: the caller supplies already-assembled events.
 */

export type TraceStage = 'Receipt' | 'Putaway' | 'Reservation' | 'Pick' | 'Pack' | 'Shipment';

export interface TraceTimelineEvent {
  id: string;
  at: string;
  stage: TraceStage;
  description: string;
  referenceId: string;
  actor: string;
}

const STAGE_TONE: Record<TraceStage, string> = {
  Receipt: 'tone-info',
  Putaway: 'tone-neutral',
  Reservation: 'tone-violet',
  Pick: 'tone-warning',
  Pack: 'tone-info',
  Shipment: 'tone-success',
};

@Component({
  selector: 'app-traceability-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traceability-timeline.component.html',
  styleUrl: './traceability-timeline.component.scss',
})
export class TraceabilityTimelineComponent {
  readonly events = input.required<TraceTimelineEvent[]>();
  readonly emptyMessage = input('Bu lot için hareket kaydı yok.');

  stageTone(stage: TraceStage): string {
    return STAGE_TONE[stage] ?? 'tone-neutral';
  }
}
