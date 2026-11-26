import { TestBed } from '@angular/core/testing';
import { CustomerMovementsService } from './customer-movements';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('CustomerMovementsService', () => {
  let service: CustomerMovementsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CustomerMovementsService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(CustomerMovementsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
