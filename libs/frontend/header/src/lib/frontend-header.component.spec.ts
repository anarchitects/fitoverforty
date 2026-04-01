import { TestBed } from '@angular/core/testing';
import { FitoverfortyFrontendHeaderComponent } from './frontend-header.component';

describe('FitoverfortyFrontendHeaderComponent', () => {
  it('renders the app title', async () => {
    await TestBed.configureTestingModule({
      imports: [FitoverfortyFrontendHeaderComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      FitoverfortyFrontendHeaderComponent,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fit Over Forty');
  });
});
