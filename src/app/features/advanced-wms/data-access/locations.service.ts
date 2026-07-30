import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { LocationClass, LocationStatus } from '../models/entities';

export interface LocationRow {
  id: string;
  path: string;
  warehouseCode: string;
  type: 'zone' | 'aisle' | 'rack' | 'bin' | 'staging';
  locationClass: LocationClass;
  status: LocationStatus;
  usedWeightKg: number;
  maxWeightKg: number;
  usedVolumeM3: number;
  maxVolumeM3: number;
}

function pct(used: number, max: number): number {
  return Math.round((used / max) * 100);
}

const RAW: Omit<LocationRow, 'id'>[] = [
  { path: 'A/01/01', warehouseCode: 'NYC-01', type: 'bin', locationClass: 'ambient', status: 'active', usedWeightKg: 420, maxWeightKg: 500, usedVolumeM3: 3.2, maxVolumeM3: 4 },
  { path: 'A/01/02', warehouseCode: 'NYC-01', type: 'bin', locationClass: 'ambient', status: 'full', usedWeightKg: 498, maxWeightKg: 500, usedVolumeM3: 3.9, maxVolumeM3: 4 },
  { path: 'A/02/01', warehouseCode: 'NYC-01', type: 'bin', locationClass: 'chilled', status: 'active', usedWeightKg: 210, maxWeightKg: 400, usedVolumeM3: 1.5, maxVolumeM3: 3 },
  { path: 'B/01/01', warehouseCode: 'NYC-01', type: 'rack', locationClass: 'ambient', status: 'blocked', usedWeightKg: 0, maxWeightKg: 1200, usedVolumeM3: 0, maxVolumeM3: 10 },
  { path: 'C/01/01', warehouseCode: 'IST-01', type: 'bin', locationClass: 'frozen', status: 'active', usedWeightKg: 150, maxWeightKg: 300, usedVolumeM3: 1.1, maxVolumeM3: 2.5 },
  { path: 'C/01/02', warehouseCode: 'IST-01', type: 'bin', locationClass: 'frozen', status: 'active', usedWeightKg: 280, maxWeightKg: 300, usedVolumeM3: 2.3, maxVolumeM3: 2.5 },
  { path: 'D/01/01', warehouseCode: 'IST-01', type: 'staging', locationClass: 'ambient', status: 'active', usedWeightKg: 600, maxWeightKg: 2000, usedVolumeM3: 5, maxVolumeM3: 20 },
  { path: 'HZ/01/01', warehouseCode: 'DXB-01', type: 'bin', locationClass: 'hazmat', status: 'active', usedWeightKg: 90, maxWeightKg: 200, usedVolumeM3: 0.6, maxVolumeM3: 1.5 },
  { path: 'A/03/01', warehouseCode: 'AMS-01', type: 'aisle', locationClass: 'ambient', status: 'inactive', usedWeightKg: 0, maxWeightKg: 0, usedVolumeM3: 0, maxVolumeM3: 0 },
  { path: 'A/03/02', warehouseCode: 'AMS-01', type: 'bin', locationClass: 'chilled', status: 'active', usedWeightKg: 320, maxWeightKg: 500, usedVolumeM3: 2.7, maxVolumeM3: 4 },
];

const MOCK_LOCATIONS: LocationRow[] = RAW.map((r, i) => ({ id: `loc-${i + 1}`, ...r }));

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly api = inject(MockApiService);

  list(): Observable<LocationRow[]> {
    return this.api.simulate(MOCK_LOCATIONS, { delayMs: 350 });
  }
}

export function capacityPct(loc: LocationRow): number {
  if (!loc.maxWeightKg) return 0;
  return pct(loc.usedWeightKg, loc.maxWeightKg);
}
