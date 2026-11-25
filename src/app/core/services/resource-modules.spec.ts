import { TestBed } from '@angular/core/testing';
import { ResourceModules } from './resource-modules';

describe('ResourceModules', () => {
  let service: ResourceModules;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResourceModules);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
