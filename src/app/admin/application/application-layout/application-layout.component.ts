import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-application-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './application-layout.component.html',
  styleUrl: './application-layout.component.scss'
})
export class ApplicationLayoutComponent {}
