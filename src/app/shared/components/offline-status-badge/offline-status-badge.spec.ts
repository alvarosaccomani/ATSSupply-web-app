import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfflineStatusBadge } from './offline-status-badge';

describe('OfflineStatusBadge', () => {
  let component: OfflineStatusBadge;
  let fixture: ComponentFixture<OfflineStatusBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineStatusBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineStatusBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
