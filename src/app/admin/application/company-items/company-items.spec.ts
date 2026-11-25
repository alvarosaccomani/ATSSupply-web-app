import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyItems } from './company-items';

describe('CompanyItems', () => {
  let component: CompanyItems;
  let fixture: ComponentFixture<CompanyItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyItems],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyItems);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
