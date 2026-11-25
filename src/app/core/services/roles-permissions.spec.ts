import { TestBed } from '@angular/core/testing';
import { RolesPermissions } from './roles-permissions';

describe('RolesPermissions', () => {
  let service: RolesPermissions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RolesPermissions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
