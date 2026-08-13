import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
    service.clear();
  });

  it('keeps an auto-dismissed toast in notification history', fakeAsync(() => {
    const id = service.success('Saved', 'Warehouse created');

    expect(service.notifications().map((item) => item.id)).toContain(id);
    expect(service.history().map((item) => item.id)).toContain(id);

    tick(3500);

    expect(service.notifications()).toEqual([]);
    expect(service.history().map((item) => item.id)).toContain(id);

    service.dismiss(id);
    expect(service.history()).toEqual([]);
  }));
});
