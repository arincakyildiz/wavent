import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * §9 PickRouteViewer — lays a pick task's location sequence out as an ordered walk,
 * marking which stops are already picked so an operator can see where they are in
 * the route and where the exception (if any) interrupted it.
 */

export interface PickRouteTask {
  code: string;
  type: string;
  assignedTo?: string;
  /** Locations in the order they must be visited. */
  route: string[];
  lineCount: number;
  pickedLines: number;
  status: string;
  exceptionReason?: string;
}

export type StopState = 'done' | 'current' | 'pending' | 'blocked';

export interface RouteStop {
  index: number;
  location: string;
  /** Zone segment of the path, used to group consecutive stops visually. */
  zone: string;
  state: StopState;
}

@Component({
  selector: 'app-pick-route-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-route-viewer.component.html',
  styleUrl: './pick-route-viewer.component.scss',
})
export class PickRouteViewerComponent {
  readonly task = input.required<PickRouteTask>();

  readonly stops = computed<RouteStop[]>(() => {
    const t = this.task();
    const total = t.route.length;
    if (!total) return [];

    // Progress is tracked in lines, so map it onto stops proportionally.
    const ratio = t.lineCount ? t.pickedLines / t.lineCount : 0;
    const doneCount = Math.min(total, Math.round(ratio * total));
    const blocked = t.status === 'exception' || !!t.exceptionReason;

    return t.route.map((location, index) => {
      let state: StopState = 'pending';
      if (index < doneCount) state = 'done';
      else if (index === doneCount) state = blocked ? 'blocked' : 'current';

      return { index: index + 1, location, zone: location.split('/')[0] ?? '—', state };
    });
  });

  readonly progressPct = computed(() => {
    const t = this.task();
    return t.lineCount ? Math.round((t.pickedLines / t.lineCount) * 100) : 0;
  });

  /** Distinct zones the route crosses — a route touching many zones walks further. */
  readonly zoneCount = computed(() => new Set(this.stops().map((s) => s.zone)).size);

  stateLabel(state: StopState): string {
    const label: Record<StopState, string> = {
      done: 'Toplandı',
      current: 'Sırada',
      pending: 'Bekliyor',
      blocked: 'İstisna',
    };
    return label[state];
  }
}
