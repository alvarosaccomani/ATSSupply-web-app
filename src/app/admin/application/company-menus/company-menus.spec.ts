import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyMenus } from './company-menus';

describe('CompanyMenus', () => {
  let component: CompanyMenus;
  let fixture: ComponentFixture<CompanyMenus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyMenus],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyMenus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
