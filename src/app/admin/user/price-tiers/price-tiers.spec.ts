import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PriceTiers } from './price-tiers';

describe('PriceTiers', () => {
  let component: PriceTiers;
  let fixture: ComponentFixture<PriceTiers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceTiers],
    }).compileComponents();

    fixture = TestBed.createComponent(PriceTiers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
