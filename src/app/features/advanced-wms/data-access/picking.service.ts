import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';
import { PickTaskStatus, PickTaskType } from '../models/entities';

export interface PickTaskRow {
  id: string;
  waveName: string;
  type: PickTaskType;
  assignedTo?: string;
  locationCount: number;
  lineCount: number;
  pickedLines: number;
  status: PickTaskStatus;
  exceptionReason?: string;
}

const MOCK_TASKS: PickTaskRow[] = [
  { id: 'pt-1', waveName: 'Wave #251', type: 'single', assignedTo: 'John Doe', locationCount: 4, lineCount: 4, pickedLines: 4, status: 'completed' },
  { id: 'pt-2', waveName: 'Wave #251', type: 'batch', assignedTo: 'Sarah Lee', locationCount: 8, lineCount: 12, pickedLines: 9, status: 'in-progress' },
  { id: 'pt-3', waveName: 'Wave #251', type: 'zone', assignedTo: 'Michael Brown', locationCount: 6, lineCount: 6, pickedLines: 5, status: 'exception', exceptionReason: 'Yanlış barkod okundu' },
  { id: 'pt-4', waveName: 'Wave #254', type: 'single', locationCount: 2, lineCount: 2, pickedLines: 0, status: 'pending' },
  { id: 'pt-5', waveName: 'Wave #254', type: 'batch', assignedTo: 'Jessica Park', locationCount: 5, lineCount: 7, pickedLines: 3, status: 'exception', exceptionReason: 'Kısa toplama: rezervasyon aşıldı' },
];

@Injectable({ providedIn: 'root' })
export class PickingService {
  private readonly api = inject(MockApiService);

  list(): Observable<PickTaskRow[]> {
    return this.api.simulate(MOCK_TASKS, { delayMs: 350 });
  }
}
