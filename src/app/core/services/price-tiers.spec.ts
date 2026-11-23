import { TestBed } from '@angular/core/testing';
import { PriceTiers } from './price-tiers';

describe('PriceTiers', () => {
  let service: PriceTiers;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriceTiers);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
