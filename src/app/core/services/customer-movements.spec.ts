import { TestBed } from '@angular/core/testing';
import { CustomerMovements } from './customer-movements';

describe('CustomerMovements', () => {
  let service: CustomerMovements;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomerMovements);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
