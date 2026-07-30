import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { PackageStatus } from '../models/entities';

export interface PackageRow {
  id: string;
  orderNumber: string;
  itemCount: number;
  weightKg: number;
  toleranceKg: number;
  weightOk: boolean;
  contentVerified: boolean;
  status: PackageStatus;
}

const MOCK_PACKAGES: PackageRow[] = [
  { id: 'pk-1', orderNumber: 'SO-10581', itemCount: 6, weightKg: 4.2, toleranceKg: 0.3, weightOk: true, contentVerified: true, status: 'sealed' },
  { id: 'pk-2', orderNumber: 'SO-10582', itemCount: 3, weightKg: 2.9, toleranceKg: 0.3, weightOk: true, contentVerified: false, status: 'open' },
  { id: 'pk-3', orderNumber: 'SO-10583', itemCount: 8, weightKg: 7.6, toleranceKg: 0.3, weightOk: false, contentVerified: true, status: 'weight-hold' },
  { id: 'pk-4', orderNumber: 'SO-10584', itemCount: 2, weightKg: 1.1, toleranceKg: 0.2, weightOk: true, contentVerified: true, status: 'shipped' },
  { id: 'pk-5', orderNumber: 'SO-10585', itemCount: 5, weightKg: 3.4, toleranceKg: 0.25, weightOk: true, contentVerified: true, status: 'sealed' },
];

@Injectable({ providedIn: 'root' })
export class PackingService {
  private readonly api = inject(MockApiService);

  list(): Observable<PackageRow[]> {
    return this.api.simulate(MOCK_PACKAGES, { delayMs: 350 });
  }

  approveWeight(id: string): Observable<PackageRow | undefined> {
    const pkg = MOCK_PACKAGES.find((p) => p.id === id);
    if (pkg) {
      pkg.weightOk = true;
      pkg.status = 'sealed';
    }
    return this.api.simulate(pkg, { delayMs: 300 });
  }
}
