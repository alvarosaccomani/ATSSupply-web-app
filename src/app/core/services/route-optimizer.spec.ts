import { TestBed } from '@angular/core/testing';
import { RouteOptimizer } from './route-optimizer';

describe('RouteOptimizer', () => {
  let service: RouteOptimizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteOptimizer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
