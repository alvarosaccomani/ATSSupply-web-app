import { TestBed } from '@angular/core/testing';
import { UserRolesCompany } from './user-roles-company';

describe('UserRolesCompany', () => {
  let service: UserRolesCompany;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserRolesCompany);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
