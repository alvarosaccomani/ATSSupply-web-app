import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { OfflineSyncService } from './offline-sync';

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(OfflineSyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
