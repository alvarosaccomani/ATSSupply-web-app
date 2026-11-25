import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResourceModules } from './resource-modules';

describe('ResourceModules', () => {
  let component: ResourceModules;
  let fixture: ComponentFixture<ResourceModules>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceModules],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceModules);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
