import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ListResult } from './list-query';
import { createListResource } from './list-resource';

describe('createListResource', () => {
  it('reports loading for the initial request and every reload', fakeAsync(() => {
    TestBed.configureTestingModule({});
    const request = signal({
      scope: ['IST-01'],
      query: { page: 1, pageSize: 20 },
    });
    const calls: Subject<ListResult<string>>[] = [];

    const resource = TestBed.runInInjectionContext(() =>
      createListResource(request, () => {
        const response = new Subject<ListResult<string>>();
        calls.push(response);
        return response;
      }),
    );

    tick();
    expect(resource.loading()).toBe(true);
    calls[0].next({ rows: ['first'], total: 1, totalPages: 1, page: 1, pageSize: 20 });
    calls[0].complete();
    tick();
    expect(resource.loading()).toBe(false);

    resource.reload();
    tick();
    expect(resource.loading()).toBe(true);
    expect(resource.rows()).toEqual(['first']);

    calls[1].next({ rows: ['second'], total: 1, totalPages: 1, page: 1, pageSize: 20 });
    calls[1].complete();
    tick();
    expect(resource.loading()).toBe(false);
    expect(resource.rows()).toEqual(['second']);
  }));
});
