import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { DonutSegment } from '../../../shared/components/donut-chart/donut-chart.component';
import { BarDatum } from '../../../shared/components/bar-chart/bar-chart.component';
import { MapMarker } from '../../../shared/components/world-map/world-map.component';

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'neutral';

export interface KpiCard {
  label: string;
  value: string;
  hint: string;
  trend: 'up' | 'down' | 'flat';
  icon: string;
  tone: Tone;
  spark: number[];
}

export interface ExceptionItem {
  title: string;
  reference: string;
  actor: string;
  ago: string;
  icon: string;
  tone: Tone;
}

export interface TimelineItem {
  title: string;
  timestamp: string;
  icon: string;
  tone: Tone;
}

export interface Operator {
  name: string;
  initials: string;
  tone: Tone;
}

export interface TaskPerformance {
  unitLabel: string;
  max: number;
  tickStep: number;
  bars: BarDatum[];
  operators: Operator[];
}

export interface ShipmentRow {
  code: string;
  carrier: string;
  status: string;
  tone: Tone;
  progressPct: number;
}

export interface TodayStat {
  label: string;
  value: string;
  unit: string;
  secondary: string;
  icon: string;
  tone: Tone;
}

export interface DashboardSummary {
  kpis: KpiCard[];
  mapPoints: MapMarker[];
  waveSegments: DonutSegment[];
  exceptions: ExceptionItem[];
  timeline: TimelineItem[];
  performance: TaskPerformance;
  shipments: ShipmentRow[];
  today: TodayStat[];
}

const MOCK_SUMMARY: DashboardSummary = {
  kpis: [
    {
      label: 'Total Inventory',
      value: '145,240',
      hint: '+2.45% vs yesterday',
      trend: 'up',
      icon: 'boxes',
      tone: 'info',
      spark: [118, 124, 121, 130, 128, 137, 142, 145],
    },
    {
      label: 'Available',
      value: '102,430',
      hint: '70.60% of total',
      trend: 'up',
      icon: 'package',
      tone: 'success',
      spark: [88, 92, 90, 96, 99, 97, 101, 102],
    },
    {
      label: 'Reserved',
      value: '32,810',
      hint: '22.58% of total',
      trend: 'flat',
      icon: 'bookmark',
      tone: 'warning',
      spark: [30, 34, 31, 36, 33, 31, 34, 33],
    },
    {
      label: 'In Transit',
      value: '10,250',
      hint: '7.05% of total',
      trend: 'flat',
      icon: 'truck',
      tone: 'info',
      spark: [8, 9, 11, 10, 12, 10, 9, 10],
    },
    {
      label: 'Exceptions',
      value: '14',
      hint: '-12.50% vs yesterday',
      trend: 'down',
      icon: 'alertTriangle',
      tone: 'danger',
      spark: [22, 20, 24, 19, 18, 17, 16, 14],
    },
  ],
  mapPoints: [
    { city: 'New York', lon: -74, lat: 40.7, value: 32540, anchor: 'end', above: true },
    { city: 'Amsterdam', lon: 4.9, lat: 52.4, value: 18430, anchor: 'middle', above: true },
    { city: 'Istanbul', lon: 29, lat: 41, value: 24510, anchor: 'start' },
    { city: 'Dubai', lon: 55.3, lat: 25.3, value: 15620, anchor: 'start' },
    { city: 'Sao Paulo', lon: -46.6, lat: -23.5, value: 12350, anchor: 'end' },
  ],
  waveSegments: [
    { label: 'Draft', value: 18, color: '#64748b' },
    { label: 'Planned', value: 32, color: '#3b82f6' },
    { label: 'Released', value: 58, color: '#22c55e' },
    { label: 'Completed', value: 24, color: '#a855f7' },
  ],
  exceptions: [
    { title: 'Wrong Barcode', reference: 'PK-2815', actor: 'John Doe', ago: '2m ago', icon: 'scanLine', tone: 'danger' },
    { title: 'Damaged Product', reference: 'RCV-1420', actor: 'Sarah Lee', ago: '15m ago', icon: 'package', tone: 'warning' },
    { title: 'Capacity Overflow', reference: 'A-12-03', actor: 'System', ago: '32m ago', icon: 'warehouse', tone: 'warning' },
    { title: 'Manual Override', reference: 'SO-10588', actor: 'Michael Brown', ago: '1h ago', icon: 'fileText', tone: 'info' },
  ],
  timeline: [
    { title: 'Wave #251 published', timestamp: 'May 20, 2024 10:24 AM', icon: 'checkCircle', tone: 'success' },
    { title: 'Picking task PK-2815 completed', timestamp: 'May 20, 2024 10:15 AM', icon: 'target', tone: 'info' },
    { title: 'Shipment #SHP-7821 closed', timestamp: 'May 20, 2024 09:58 AM', icon: 'truck', tone: 'success' },
    { title: 'Exception created - Wrong Barcode', timestamp: 'May 20, 2024 09:41 AM', icon: 'alertTriangle', tone: 'danger' },
    { title: 'ASN #ASN-4887 received', timestamp: 'May 20, 2024 09:20 AM', icon: 'inbox', tone: 'info' },
  ],
  performance: {
    unitLabel: 'Lines / Hour',
    max: 200,
    tickStep: 50,
    bars: [
      { label: 'John D.', value: 185 },
      { label: 'Sarah L.', value: 162 },
      { label: 'Michael B.', value: 148 },
      { label: 'Jessica P.', value: 138 },
      { label: 'David W.', value: 115 },
    ],
    operators: [
      { name: 'John D.', initials: 'JD', tone: 'info' },
      { name: 'Sarah L.', initials: 'SL', tone: 'success' },
      { name: 'Michael B.', initials: 'MB', tone: 'warning' },
      { name: 'Jessica P.', initials: 'JP', tone: 'violet' },
      { name: 'David W.', initials: 'DW', tone: 'neutral' },
    ],
  },
  shipments: [
    { code: 'SHP-7821', carrier: 'DHL Express', status: 'In Transit', tone: 'info', progressPct: 75 },
    { code: 'SHP-7820', carrier: 'Maersk', status: 'In Transit', tone: 'info', progressPct: 60 },
    { code: 'SHP-7819', carrier: 'FedEx', status: 'Loaded', tone: 'success', progressPct: 100 },
    { code: 'SHP-7818', carrier: 'UPS', status: 'Delivered', tone: 'success', progressPct: 100 },
    { code: 'SHP-7817', carrier: 'Aramex', status: 'Processing', tone: 'warning', progressPct: 25 },
  ],
  today: [
    { label: 'Receiving Today', value: '8', unit: 'ASN', secondary: '120 Lines', icon: 'inbox', tone: 'info' },
    { label: 'Putaway Today', value: '12', unit: 'Tasks', secondary: '320 Lines', icon: 'putaway', tone: 'success' },
    { label: 'Picking Today', value: '58', unit: 'Tasks', secondary: '1,250 Lines', icon: 'target', tone: 'violet' },
    { label: 'Packing Today', value: '42', unit: 'Tasks', secondary: '980 Lines', icon: 'package', tone: 'info' },
    { label: 'Shipping Today', value: '24', unit: 'Shipments', secondary: '1,100 Lines', icon: 'truck', tone: 'warning' },
  ],
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(MockApiService);

  getSummary(): Observable<DashboardSummary> {
    return this.api.simulate(MOCK_SUMMARY, { delayMs: 400 });
  }
}
