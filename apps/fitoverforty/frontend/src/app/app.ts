import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FitoverfortyFrontendHeaderComponent } from '@fitoverforty/frontend-header';
import { FitoverfortyFrontendFooterComponent } from '@fitoverforty/frontend-footer';

@Component({
  imports: [
    RouterOutlet,
    FitoverfortyFrontendHeaderComponent,
    FitoverfortyFrontendFooterComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'Fit Over Forty';
}
