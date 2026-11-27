import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '@services/customers';
import { CompanyContextService } from '@services/company-context';
import { CustomerInterface } from '@interfaces/customer';
import { PriceTierInterface } from '@interfaces/price-tier';
import { MapComponent, MapMarker } from '@components/map/map';

export type CustomerFormTierCode = 'A' | 'B' | 'C' | string;

export interface CustomerModalData {
  id?: string;
  cus_uuid?: string;
  name?: string;
  cus_name?: string;
  address?: string;
  cus_address?: string;
  phone?: string;
  cus_phone?: string;
  tier?: CustomerFormTierCode;
  prct_uuid?: string;
  hasCredit?: boolean;
  cus_hascredit?: boolean;
  lat?: number | null;
  cus_lat?: number | null;
  lng?: number | null;
  cus_lng?: number | null;
}

@Component({
  selector: 'app-customer-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent],
  templateUrl: './customer-form-modal.html',
  styleUrl: './customer-form-modal.scss'
})
export class CustomerFormModal implements OnChanges {
  private readonly _customerService = inject(CustomerService);
  private readonly _companyContext = inject(CompanyContextService);

  @Input() isOpen = false;
  @Input() customer: CustomerModalData | null = null;
  @Input() priceTiers: PriceTierInterface[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CustomerInterface>();

  // Rol del usuario activo (solo el Dueño puede ver/habilitar cuenta corriente)
  readonly isOwner = this._companyContext.isOwner;

  // Estados del Formulario
  readonly isEditing = computed<boolean>(() => Boolean(this.customer?.id || this.customer?.cus_uuid));
  readonly isSaving = signal<boolean>(false);
  readonly isLocating = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Campos reactivos
  readonly name = signal<string>('');
  readonly address = signal<string>('');
  readonly phone = signal<string>('');
  readonly tier = signal<string>('C');
  readonly hasCredit = signal<boolean>(false);
  readonly lat = signal<number | null>(null);
  readonly lng = signal<number | null>(null);

  // Centro reactivo para el mapa de geolocalización
  readonly customerMapCenter = computed<[number, number]>(() => {
    const lat = this.lat();
    const lng = this.lng();
    if (lat != null && lng != null) {
      return [lng, lat];
    }
    const comp = this._companyContext.activeCompany();
    if (comp?.cmp_lat != null && comp?.cmp_lng != null) {
      return [Number(comp.cmp_lng), Number(comp.cmp_lat)];
    }
    return [-64.1888, -31.4201];
  });

  // Pin reactivo en el mapa
  readonly customerMapMarkers = computed<MapMarker[]>(() => {
    const lat = this.lat();
    const lng = this.lng();
    if (lat == null || lng == null) return [];

    const label = this.name().trim() || 'Ubicación seleccionada';
    return [
      {
        id: 'customer-pin',
        lng,
        lat,
        title: label,
        color: '#ef4444',
        draggable: true,
        popupHtml: `<strong>${label}</strong><br><span class="text-muted small">Arrastrá el pin para ajustar la entrada</span>`
      }
    ];
  });

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this._resetForm();
    }
  }

  private _resetForm(): void {
    this.errorMessage.set(null);
    this.isSaving.set(false);
    this.isLocating.set(false);

    if (this.customer) {
      this.name.set(this.customer.name || this.customer.cus_name || '');
      this.address.set(this.customer.address || this.customer.cus_address || '');
      this.phone.set(this.customer.phone || this.customer.cus_phone || '');
      this.tier.set(this.customer.tier || 'C');
      this.hasCredit.set(Boolean(this.customer.hasCredit ?? this.customer.cus_hascredit));
      this.lat.set(this.customer.lat ?? this.customer.cus_lat ?? null);
      this.lng.set(this.customer.lng ?? this.customer.cus_lng ?? null);
    } else {
      this.name.set('');
      this.address.set('');
      this.phone.set('');
      this.tier.set('C');
      this.hasCredit.set(false);
      this.lat.set(null);
      this.lng.set(null);
    }
  }

  public onMapPointSelected(coords: { lng: number; lat: number }): void {
    this.lat.set(Number(coords.lat.toFixed(6)));
    this.lng.set(Number(coords.lng.toFixed(6)));
  }

  public clearGps(): void {
    this.lat.set(null);
    this.lng.set(null);
  }

  public getCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.errorMessage.set('La geolocalización no está soportada en este dispositivo.');
      return;
    }

    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocating.set(false);
        this.lat.set(Number(pos.coords.latitude.toFixed(6)));
        this.lng.set(Number(pos.coords.longitude.toFixed(6)));
      },
      (err) => {
        this.isLocating.set(false);
        let msg = 'No se pudo obtener la posición GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permiso denegado para acceder al GPS del dispositivo.';
        }
        this.errorMessage.set(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  public closeModal(): void {
    if (this.isSaving()) return;
    this.closed.emit();
  }

  public saveCustomer(): void {
    const name = this.name().trim();
    const address = this.address().trim();

    if (!name) {
      this.errorMessage.set('El nombre o razón social del cliente es obligatorio.');
      return;
    }

    if (!address) {
      this.errorMessage.set('La dirección del cliente es obligatoria.');
      return;
    }

    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      this.errorMessage.set('No hay una empresa activa seleccionada.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const selectedTierCode = this.tier();
    const matchingTier = this.priceTiers.find(
      (t) => t.prct_code?.toUpperCase() === selectedTierCode
    );

    const payload: Partial<CustomerInterface> = {
      cmp_uuid,
      prct_uuid: matchingTier?.prct_uuid,
      cus_name: name.toUpperCase(),
      cus_address: address,
      cus_phone: this.phone().trim(),
      cus_lat: this.lat(),
      cus_lng: this.lng(),
      cus_hascredit: this.isOwner() ? this.hasCredit() : false,
      cus_active: true
    };

    const customerId = this.customer?.id || this.customer?.cus_uuid;

    if (customerId) {
      this._customerService.updateCustomer(cmp_uuid, customerId, payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          const updated = res?.data || ({ ...payload, cus_uuid: customerId } as CustomerInterface);
          this.saved.emit(updated);
          this.closeModal();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al actualizar cliente:', err);
          this.errorMessage.set(err?.error?.error || err?.error?.message || 'Error al actualizar cliente.');
        }
      });
    } else {
      this._customerService.saveCustomer(payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          const created = res?.data || ({ ...payload } as CustomerInterface);
          this.saved.emit(created);
          this.closeModal();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al registrar cliente:', err);
          this.errorMessage.set(err?.error?.error || err?.error?.message || 'Error al registrar cliente.');
        }
      });
    }
  }
}
