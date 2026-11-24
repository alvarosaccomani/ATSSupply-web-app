import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaService } from '@services/pwa';
import { OfflineSyncService } from '@services/offline-sync';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ATSSupply-web-app');
  private readonly _pwa = inject(PwaService);
  private readonly _offlineSync = inject(OfflineSyncService);
}
