import { TestBed } from '@angular/core/testing';
import { OrderHistoryService } from './order-history';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('OrderHistoryService', () => {
  let service: OrderHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrderHistoryService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(OrderHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
