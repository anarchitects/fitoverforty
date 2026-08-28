import { TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  it('renders the current year and brand text', async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      FooterComponent,
    );
    fixture.detectChanges();

    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('Fit Over Forty');
    expect(rendered).toContain(String(new Date().getFullYear()));
  });
});
