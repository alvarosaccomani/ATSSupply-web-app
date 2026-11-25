import { TestBed } from '@angular/core/testing';
import { ResourceTypes } from './resource-types';

describe('ResourceTypes', () => {
  let service: ResourceTypes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResourceTypes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
