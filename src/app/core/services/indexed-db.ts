import { Injectable } from '@angular/core';
import { PendingSyncItem } from '@interfaces/offline-sync';
import { ProductInterface } from '@interfaces/product';
import { CustomerInterface } from '@interfaces/customer';
import { PriceTierInterface } from '@interfaces/price-tier';

const DB_NAME = 'ATSSupply_OfflineDB';
const DB_VERSION = 1;

export const STORES = {
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  PRICE_TIERS: 'price_tiers',
  SYNC_QUEUE: 'sync_queue'
} as const;

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private _dbPromise: Promise<IDBDatabase> | null = null;

  public async getDb(): Promise<IDBDatabase> {
    if (!this._dbPromise) {
      this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('IndexedDB is not supported in this environment'));
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Products store
          if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
            const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'prd_uuid' });
            productStore.createIndex('cmp_uuid', 'cmp_uuid', { unique: false });
          }

          // Customers store
          if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
            const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'cus_uuid' });
            customerStore.createIndex('cmp_uuid', 'cmp_uuid', { unique: false });
          }

          // Price Tiers store
          if (!db.objectStoreNames.contains(STORES.PRICE_TIERS)) {
            const priceTierStore = db.createObjectStore(STORES.PRICE_TIERS, { keyPath: 'prct_uuid' });
            priceTierStore.createIndex('cmp_uuid', 'cmp_uuid', { unique: false });
          }

          // Sync Queue store
          if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
            const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
              keyPath: 'id',
              autoIncrement: true
            });
            syncStore.createIndex('cmp_uuid', 'cmp_uuid', { unique: false });
            syncStore.createIndex('client_uuid', 'client_uuid', { unique: true });
            syncStore.createIndex('status', 'status', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return this._dbPromise;
  }

  // --- Products Catalog ---
  public async saveProducts(cmpUuid: string, products: ProductInterface[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORES.PRODUCTS);

    for (const prod of products) {
      store.put({ ...prod, cmp_uuid: cmpUuid });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getProducts(cmpUuid: string): Promise<ProductInterface[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.PRODUCTS, 'readonly');
    const index = tx.objectStore(STORES.PRODUCTS).index('cmp_uuid');
    const request = index.getAll(IDBKeyRange.only(cmpUuid));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Customers Catalog ---
  public async saveCustomers(cmpUuid: string, customers: CustomerInterface[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.CUSTOMERS, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS);

    for (const cust of customers) {
      store.put({ ...cust, cmp_uuid: cmpUuid });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getCustomers(cmpUuid: string): Promise<CustomerInterface[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.CUSTOMERS, 'readonly');
    const index = tx.objectStore(STORES.CUSTOMERS).index('cmp_uuid');
    const request = index.getAll(IDBKeyRange.only(cmpUuid));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Price Tiers Catalog ---
  public async savePriceTiers(cmpUuid: string, tiers: PriceTierInterface[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.PRICE_TIERS, 'readwrite');
    const store = tx.objectStore(STORES.PRICE_TIERS);

    for (const tier of tiers) {
      store.put({ ...tier, cmp_uuid: cmpUuid });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getPriceTiers(cmpUuid: string): Promise<PriceTierInterface[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.PRICE_TIERS, 'readonly');
    const index = tx.objectStore(STORES.PRICE_TIERS).index('cmp_uuid');
    const request = index.getAll(IDBKeyRange.only(cmpUuid));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Sync Queue Operations ---
  public async enqueueSyncItem<T>(item: Omit<PendingSyncItem<T>, 'id'>): Promise<number> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.add(item);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  public async getPendingSyncItems(cmpUuid?: string): Promise<PendingSyncItem[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    const request = cmpUuid
      ? store.index('cmp_uuid').getAll(IDBKeyRange.only(cmpUuid))
      : store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const items = (request.result as PendingSyncItem[]) || [];
        const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
        pending.sort((a, b) => (a.id || 0) - (b.id || 0));
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async updateSyncItem(item: PendingSyncItem): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    store.put(item);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async removeSyncItem(id: number): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
