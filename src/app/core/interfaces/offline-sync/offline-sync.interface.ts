export type OfflineSyncOperationType =
  | 'CREATE_ORDER'
  | 'UPDATE_ORDER_STATUS'
  | 'CREATE_CUSTOMER';

export type OfflineSyncStatus = 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export interface PendingSyncItem<T = unknown> {
  id?: number;
  client_uuid: string;
  cmp_uuid: string;
  type: OfflineSyncOperationType;
  payload: T;
  attempts: number;
  lastAttemptAt?: string | null;
  status: OfflineSyncStatus;
  errorMessage?: string | null;
  createdAt: string;
}

export interface OfflineSyncInterface {
  pendingCount: number;
  lastSyncTimestamp: string | null;
  items: PendingSyncItem[];
}
