import { TestBed } from '@angular/core/testing';
import { FitoverfortyFrontendFooterComponent } from './frontend-footer.component';

describe('FitoverfortyFrontendFooterComponent', () => {
  it('renders the current year and brand text', async () => {
    await TestBed.configureTestingModule({
      imports: [FitoverfortyFrontendFooterComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      FitoverfortyFrontendFooterComponent,
    );
    fixture.detectChanges();

    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('Fit Over Forty');
    expect(rendered).toContain(String(new Date().getFullYear()));
  });
});
