import { TestBed } from '@angular/core/testing';
import { ProductionOrders } from './production-orders';

describe('ProductionOrders', () => {
  let service: ProductionOrders;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductionOrders);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
