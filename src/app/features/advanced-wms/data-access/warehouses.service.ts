import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  operatingHours: { open: string; close: string };
  isActive: boolean;
  locationCount: number;
  capacityUsedPct: number;
  inventoryUnits: number;
}

const MOCK_WAREHOUSES: WarehouseSummary[] = [
  {
    id: 'wh-1',
    code: 'NYC-01',
    name: 'New York DC',
    city: 'New York',
    country: 'USA',
    timezone: 'America/New_York',
    operatingHours: { open: '06:00', close: '22:00' },
    isActive: true,
    locationCount: 1240,
    capacityUsedPct: 78,
    inventoryUnits: 32540,
  },
  {
    id: 'wh-2',
    code: 'AMS-01',
    name: 'Amsterdam Hub',
    city: 'Amsterdam',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    operatingHours: { open: '05:00', close: '21:00' },
    isActive: true,
    locationCount: 860,
    capacityUsedPct: 54,
    inventoryUnits: 18430,
  },
  {
    id: 'wh-3',
    code: 'IST-01',
    name: 'Istanbul Merkez',
    city: 'Istanbul',
    country: 'Turkey',
    timezone: 'Europe/Istanbul',
    operatingHours: { open: '06:00', close: '23:00' },
    isActive: true,
    locationCount: 1520,
    capacityUsedPct: 91,
    inventoryUnits: 24510,
  },
  {
    id: 'wh-4',
    code: 'DXB-01',
    name: 'Dubai Logistics Park',
    city: 'Dubai',
    country: 'UAE',
    timezone: 'Asia/Dubai',
    operatingHours: { open: '00:00', close: '23:59' },
    isActive: true,
    locationCount: 980,
    capacityUsedPct: 63,
    inventoryUnits: 15620,
  },
  {
    id: 'wh-5',
    code: 'GRU-01',
    name: 'Sao Paulo Cross-dock',
    city: 'Sao Paulo',
    country: 'Brazil',
    timezone: 'America/Sao_Paulo',
    operatingHours: { open: '07:00', close: '19:00' },
    isActive: false,
    locationCount: 410,
    capacityUsedPct: 22,
    inventoryUnits: 12350,
  },
];

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly api = inject(MockApiService);

  list(): Observable<WarehouseSummary[]> {
    return this.api.simulate(MOCK_WAREHOUSES, { delayMs: 400 });
  }
}
