import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { EN } from './locales/en';
import { TR } from './locales/tr';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

/**
 * The catalogs are the only thing standing between "translated" and "half
 * translated", so their parity is asserted rather than trusted: a key added to one
 * language and forgotten in the other fails here instead of rendering a Turkish
 * string to an English user.
 */
describe('i18n catalogs', () => {
  it('has no key present in Turkish but missing from English', () => {
    const missing = Object.keys(TR).filter((key) => !(key in EN));
    expect(missing).toEqual([]);
  });

  it('has no key present in English but missing from Turkish', () => {
    const missing = Object.keys(EN).filter((key) => !(key in TR));
    expect(missing).toEqual([]);
  });

  it('has no empty translations', () => {
    const blank = [...Object.entries(TR), ...Object.entries(EN)]
      .filter(([, value]) => !value.trim())
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');

    const mismatched = Object.keys(TR).filter(
      (key) => key in EN && placeholders(TR[key]) !== placeholders(EN[key]),
    );
    expect(mismatched).toEqual([]);
  });

  it('leaves no untranslated Turkish characters in the English catalog', () => {
    // Catches a key that was copied across but never actually translated.
    const suspicious = Object.entries(EN)
      .filter(([, value]) => /[çğıöşÇĞİÖŞÜ]/.test(value))
      .map(([key]) => key);
    expect(suspicious).toEqual([]);
  });
});

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
    service.set('tr');
  });

  afterEach(() => service.set('tr'));

  it('returns the Turkish string by default', () => {
    expect(service.t('common.retry')).toBe(TR['common.retry']);
  });

  it('switches every lookup when the locale changes', () => {
    service.set('en');
    expect(service.t('common.retry')).toBe(EN['common.retry']);
  });

  it('substitutes placeholders', () => {
    expect(service.t('login.permissionCount', { count: 11 })).toContain('11');
  });

  it('falls back to the key itself so a gap is visible, not blank', () => {
    expect(service.t('does.not.exist')).toBe('does.not.exist');
  });

  it('records the locale on the document so screen readers follow it', () => {
    service.set('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });
});

/**
 * The switch has to repaint live text, not just change what `t()` returns — signal reads
 * inside a template are what make that true, so this asserts it against a real render.
 */
describe('locale switching in a template', () => {
  it('repaints rendered strings when the language changes', async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();

    const fixture = TestBed.createComponent(PaginationComponent);
    const i18n = TestBed.inject(I18nService);
    i18n.set('tr');
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('total', 42);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.detectChanges();

    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Sayfa başına');

    i18n.set('en');
    fixture.detectChanges();

    expect(text()).toContain('Per page');
    expect(text()).not.toContain('Sayfa başına');
  });
});
