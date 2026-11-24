import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private _deferredPrompt: any = null;

  // Reactive state
  readonly isInstallable = signal<boolean>(false);
  readonly hasUpdate = signal<boolean>(false);
  readonly isSupported = signal<boolean>(typeof navigator !== 'undefined' && 'serviceWorker' in navigator);

  private _registration: ServiceWorkerRegistration | null = null;
  private _waitingWorker: ServiceWorker | null = null;

  constructor() {
    this._initPwa();
  }

  private _initPwa(): void {
    if (typeof window === 'undefined') return;

    // Listen to PWA install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this.isInstallable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      this.isInstallable.set(false);
      console.log('[PWA] Application successfully installed');
    });

    // Register Service Worker in production or supporting browsers
    if (this.isSupported()) {
      this._registerServiceWorker();
    }
  }

  private async _registerServiceWorker(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this._registration = registration;

      // Check if there is an update waiting
      if (registration.waiting) {
        this._waitingWorker = registration.waiting;
        this.hasUpdate.set(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this._waitingWorker = newWorker;
              this.hasUpdate.set(true);
            }
          });
        }
      });

      // Reload on controller change once updated
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Request Background Sync if supported
      await this.requestBackgroundSync('sync-orders');
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  }

  /**
   * Prompts the user to install the PWA on device.
   */
  public async promptInstall(): Promise<boolean> {
    if (!this._deferredPrompt) return false;

    this._deferredPrompt.prompt();
    const { outcome } = await this._deferredPrompt.userChoice;
    this._deferredPrompt = null;
    this.isInstallable.set(false);
    return outcome === 'accepted';
  }

  /**
   * Activates pending worker update and reloads the application.
   */
  public activateUpdate(): void {
    if (this._waitingWorker) {
      this._waitingWorker.postMessage({ action: 'SKIP_WAITING' });
    }
  }

  /**
   * Registers a W3C Background Sync event tag.
   */
  public async requestBackgroundSync(tag: string = 'sync-orders'): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      if ('sync' in reg) {
        await (reg as any).sync.register(tag);
        return true;
      }
    } catch (err) {
      console.warn(`[PWA] Background Sync for tag '${tag}' not supported or failed:`, err);
    }
    return false;
  }
}
