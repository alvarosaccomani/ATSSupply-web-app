import { Injectable } from '@angular/core';

export interface NominatimAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

export interface NominatimReverseResponse {
  display_name?: string;
  address?: NominatimAddress;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  /**
   * Obtiene la dirección aproximada (calle, altura, ciudad) a partir de coordenadas GPS
   * utilizando la API pública de OpenStreetMap / Nominatim con fallback seguro.
   */
  public async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        return null;
      }

      const data: NominatimReverseResponse = await response.json();
      return this.formatAddress(data);
    } catch (err) {
      console.warn('No se pudo resolver la geocodificación inversa:', err);
      return null;
    }
  }

  /**
   * Formatea los datos de Nominatim en una dirección concisa estilo "Calle Altura, Ciudad".
   */
  public formatAddress(data: NominatimReverseResponse): string | null {
    if (!data || !data.address) {
      return data?.display_name || null;
    }

    const { road, house_number, neighbourhood, suburb, city, town, village } = data.address;
    const locality = city || town || village || suburb || neighbourhood || '';

    if (road) {
      const streetWithNumber = house_number ? `${road} ${house_number}` : road;
      return locality ? `${streetWithNumber}, ${locality}` : streetWithNumber;
    }

    if (data.display_name) {
      return data.display_name.split(',').slice(0, 3).join(',').trim();
    }

    return null;
  }
}
