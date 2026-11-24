import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OfflineSyncService } from '@services/offline-sync';
import { PwaService } from '@services/pwa';

@Component({
  selector: 'app-offline-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-status-badge.html',
  styleUrl: './offline-status-badge.scss'
})
export class OfflineStatusBadgeComponent {
  readonly offlineSync = inject(OfflineSyncService);
  readonly pwaService = inject(PwaService);

  readonly isOnline = this.offlineSync.isOnline;
  readonly pendingCount = this.offlineSync.pendingCount;
  readonly isSyncing = this.offlineSync.isSyncing;
  readonly hasUpdate = this.pwaService.hasUpdate;

  public onSyncNow(): void {
    if (!this.isSyncing()) {
      this.offlineSync.processSyncQueue();
    }
  }

  public onApplyUpdate(): void {
    this.pwaService.activateUpdate();
  }
}
