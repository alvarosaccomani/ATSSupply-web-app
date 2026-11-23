import { TestBed } from '@angular/core/testing';
import { PriceTierService } from './price-tiers';

describe('PriceTierService', () => {
  let service: PriceTierService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriceTierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
