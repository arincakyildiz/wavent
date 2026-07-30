import { Component, inject, signal } from '@angular/core';
import { PackageRow, PackingService } from '../../data-access/packing.service';

type LoadState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-packing',
  imports: [],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss',
})
export class PackingComponent {
  private readonly packingService = inject(PackingService);

  readonly state = signal<LoadState>('loading');
  readonly packages = signal<PackageRow[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.packingService.list().subscribe({
      next: (rows) => {
        this.packages.set(rows);
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  approveWeight(pkg: PackageRow): void {
    this.packingService.approveWeight(pkg.id).subscribe((updated) => {
      if (!updated) return;
      this.packages.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    });
  }

  statusTone(status: PackageRow['status']): string {
    const tone: Record<PackageRow['status'], string> = {
      open: 'tone-neutral',
      sealed: 'tone-success',
      'weight-hold': 'tone-danger',
      shipped: 'tone-info',
    };
    return tone[status];
  }
}
