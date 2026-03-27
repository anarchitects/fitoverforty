import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    class: 'anx-root',
    '[attr.data-anx-theme]': "'fitoverforty'",
    '[attr.data-anx-density]': "'comfortable'",
    '[attr.data-anx-surface]': "'plain'",
  },
})
export class App {
  protected title = 'Fit Over Forty';
}
