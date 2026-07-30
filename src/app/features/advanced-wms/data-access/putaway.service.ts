import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockApiService } from '../../../core/api/mock-api.service';

export interface PutawaySuggestionRow {
  id: string;
  sku: string;
  lot?: string;
  quantity: number;
  suggestedLocationPath: string;
  score: number;
  reasons: string[];
  accepted: boolean;
}

const MOCK_SUGGESTIONS: PutawaySuggestionRow[] = [
  { id: 'pw-1', sku: 'SKU-1001', lot: 'L-24081', quantity: 3200, suggestedLocationPath: 'A/01/01', score: 96, reasons: ['Aynı ürün sınıfı', 'Boş kapasite yeterli', 'FEFO sırası uygun'], accepted: true },
  { id: 'pw-2', sku: 'SKU-1006', lot: 'L-24090', quantity: 1400, suggestedLocationPath: 'A/02/01', score: 88, reasons: ['Sıcaklık uygun', 'Kısa taşıma mesafesi'], accepted: false },
  { id: 'pw-3', sku: 'SKU-1004', lot: 'L-24070', quantity: 600, suggestedLocationPath: 'C/01/02', score: 74, reasons: ['Frozen sınıfı uygun', 'Kapasite %80 dolulukta'], accepted: false },
  { id: 'pw-4', sku: 'SKU-1002', quantity: 950, suggestedLocationPath: 'A/03/02', score: 91, reasons: ['Ambient sınıf', 'Yüksek erişilebilirlik'], accepted: false },
  { id: 'pw-5', sku: 'SKU-1008', quantity: 60, suggestedLocationPath: 'HZ/01/01', score: 99, reasons: ['Hazmat lokasyon zorunlu', 'Seri takip uygun'], accepted: true },
];

@Injectable({ providedIn: 'root' })
export class PutawayService {
  private readonly api = inject(MockApiService);

  list(): Observable<PutawaySuggestionRow[]> {
    return this.api.simulate(MOCK_SUGGESTIONS, { delayMs: 350 });
  }
}
