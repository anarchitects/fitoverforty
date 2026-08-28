import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  it('renders the app title', async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      HeaderComponent,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fit Over Forty');
  });
});
