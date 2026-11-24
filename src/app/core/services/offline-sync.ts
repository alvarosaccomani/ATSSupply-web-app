import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IndexedDbService } from './indexed-db';
import { PendingSyncItem, OfflineSyncOperationType } from '@interfaces/offline-sync';
import { OrderCreateInput, OrderInterface } from '@interfaces/order';

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private readonly _http = inject(HttpClient);
  private readonly _indexedDb = inject(IndexedDbService);

  // Reactive state signals
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly pendingCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncTimestamp = signal<string | null>(null);

  constructor() {
    this._initNetworkListeners();
    this.refreshPendingCount();
  }

  private _initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });

    // Listen to background sync trigger from Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
          this.processSyncQueue();
        }
      });
    }
  }

  /**
   * Generates a standard UUID v4 for request idempotency.
   */
  public generateClientUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Refreshes the pending count signal from IndexedDB.
   */
  public async refreshPendingCount(cmpUuid?: string): Promise<number> {
    try {
      const pendingItems = await this._indexedDb.getPendingSyncItems(cmpUuid);
      const count = pendingItems.length;
      this.pendingCount.set(count);
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Enqueues an order creation to be synced with the backend.
   */
  public async enqueueOrderCreation(
    cmpUuid: string,
    order: OrderCreateInput
  ): Promise<string> {
    const clientUuid = this.generateClientUuid();

    const syncItem: Omit<PendingSyncItem<OrderCreateInput>, 'id'> = {
      client_uuid: clientUuid,
      cmp_uuid: cmpUuid,
      type: 'CREATE_ORDER',
      payload: { ...order, ord_uuid: order.ord_uuid || clientUuid },
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    await this._indexedDb.enqueueSyncItem(syncItem);
    await this.refreshPendingCount(cmpUuid);

    // If online, try to sync immediately
    if (this.isOnline()) {
      this.processSyncQueue(cmpUuid);
    }

    return clientUuid;
  }

  /**
   * Enqueues an order status update (e.g. PAGADO, ENTREGADO_DEBE).
   */
  public async enqueueOrderStatusUpdate(
    cmpUuid: string,
    ordUuid: string,
    newStatus: string
  ): Promise<string> {
    const clientUuid = this.generateClientUuid();

    const syncItem: Omit<PendingSyncItem<{ ord_uuid: string; status: string }>, 'id'> = {
      client_uuid: clientUuid,
      cmp_uuid: cmpUuid,
      type: 'UPDATE_ORDER_STATUS',
      payload: { ord_uuid: ordUuid, status: newStatus },
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    await this._indexedDb.enqueueSyncItem(syncItem);
    await this.refreshPendingCount(cmpUuid);

    if (this.isOnline()) {
      this.processSyncQueue(cmpUuid);
    }

    return clientUuid;
  }

  /**
   * Sequential FIFO queue processor.
   */
  public async processSyncQueue(cmpUuid?: string): Promise<void> {
    if (this.isSyncing() || !this.isOnline()) {
      return;
    }

    this.isSyncing.set(true);

    try {
      const items = await this._indexedDb.getPendingSyncItems(cmpUuid);

      for (const item of items) {
        if (!item.id) continue;

        item.status = 'SYNCING';
        item.attempts += 1;
        item.lastAttemptAt = new Date().toISOString();
        await this._indexedDb.updateSyncItem(item);

        try {
          await this._dispatchItem(item);
          // On success: remove from local queue
          await this._indexedDb.removeSyncItem(item.id);
        } catch (error: any) {
          console.error(`[OfflineSync] Error syncing item ${item.client_uuid}:`, error);
          item.status = 'FAILED';
          item.errorMessage = error?.message || 'Network/Server Error';
          await this._indexedDb.updateSyncItem(item);
          // Stop sequential processing if network failed to prevent out-of-order execution
          if (!navigator.onLine) {
            this.isOnline.set(false);
            break;
          }
        }
      }

      this.lastSyncTimestamp.set(new Date().toISOString());
    } finally {
      await this.refreshPendingCount(cmpUuid);
      this.isSyncing.set(false);
    }
  }

  private async _dispatchItem(item: PendingSyncItem): Promise<void> {
    const headers = new HttpHeaders({
      'content-type': 'application/json',
      'x-client-uuid': item.client_uuid,
      'x-offline-sync': 'true'
    });

    switch (item.type) {
      case 'CREATE_ORDER': {
        const url = `${environment.apiUrl}order`;
        await firstValueFrom(this._http.post(url, item.payload, { headers }));
        break;
      }
      case 'UPDATE_ORDER_STATUS': {
        const payload = item.payload as { ord_uuid: string; status: string };
        const url = `${environment.apiUrl}order/${item.cmp_uuid}/${payload.ord_uuid}`;
        await firstValueFrom(
          this._http.put(url, { ord_status: payload.status }, { headers })
        );
        break;
      }
      default:
        console.warn(`[OfflineSync] Unknown operation type: ${item.type}`);
    }
  }
}
