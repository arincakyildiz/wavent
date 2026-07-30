import { Component, inject, signal } from '@angular/core';
import { PutawayService, PutawaySuggestionRow } from '../../data-access/putaway.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-putaway',
  imports: [],
  templateUrl: './putaway.component.html',
  styleUrl: './putaway.component.scss',
})
export class PutawayComponent {
  private readonly putawayService = inject(PutawayService);

  readonly state = signal<LoadState>('loading');
  readonly suggestions = signal<PutawaySuggestionRow[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.putawayService.list().subscribe({
      next: (rows) => {
        this.suggestions.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  accept(row: PutawaySuggestionRow): void {
    this.suggestions.update((list) =>
      list.map((s) => (s.id === row.id ? { ...s, accepted: true } : s)),
    );
  }

  scoreTone(score: number): string {
    if (score >= 90) return 'tone-success';
    if (score >= 75) return 'tone-warning';
    return 'tone-danger';
  }
}
