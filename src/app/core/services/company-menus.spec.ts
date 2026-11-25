import { TestBed } from '@angular/core/testing';
import { CompanyMenus } from './company-menus';

describe('CompanyMenus', () => {
  let service: CompanyMenus;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyMenus);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
