import { TestBed } from '@angular/core/testing';
import { ProductBom } from './product-bom';

describe('ProductBom', () => {
  let service: ProductBom;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductBom);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
