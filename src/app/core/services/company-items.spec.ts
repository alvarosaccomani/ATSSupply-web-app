import { TestBed } from '@angular/core/testing';
import { CompanyItems } from './company-items';

describe('CompanyItems', () => {
  let service: CompanyItems;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyItems);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
