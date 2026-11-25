import { TestBed } from '@angular/core/testing';
import { CompanySettings } from './company-settings';

describe('CompanySettings', () => {
  let service: CompanySettings;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanySettings);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
