import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PriceTierInterface,
  PriceTierResultsInterface,
  PriceTierSingleResultInterface
} from '@interfaces/price-tier';

@Injectable({
  providedIn: 'root'
})
export class PriceTierService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista de listas de precios para una compañía.
   */
  public getPriceTiers(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<PriceTierResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}price-tiers/${cmp_uuid}`;
    if (filter) {
      url += `/${encodeURIComponent(filter)}`;
      if (page !== undefined) {
        url += `/${page}`;
        if (perPage !== undefined) {
          url += `/${perPage}`;
        }
      }
    } else if (page !== undefined) {
      url += `/all/${page}`;
      if (perPage !== undefined) {
        url += `/${perPage}`;
      }
    }

    return this._http.get<PriceTierResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle de una lista de precios por UUID.
   */
  public getPriceTierById(
    cmp_uuid: string,
    prct_uuid: string
  ): Observable<PriceTierSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<PriceTierSingleResultInterface>(
      `${environment.apiUrl}price-tier/${cmp_uuid}/${prct_uuid}`,
      { headers }
    );
  }
}