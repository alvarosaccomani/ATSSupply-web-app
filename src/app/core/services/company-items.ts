import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompanyItemInterface,
  CompanyItemResultsInterface,
  CompanyItemSingleResultInterface
} from '@interfaces/company-item';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class CompanyItemsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista de rubros asignados a una empresa tenant específica.
   */
  public getCompanyItems(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<CompanyItemResultsInterface | SingleResult<CompanyItemInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}company-items/${cmp_uuid}`;

    if (filter) {
      url += `/${encodeURIComponent(filter)}`;
      if (page !== undefined) {
        url += `/${page}`;
        if (perPage !== undefined) {
          url += `/${perPage}`;
        }
      }
    } else if (page !== undefined && perPage !== undefined) {
      url += `?page=${page}&perPage=${perPage}`;
    }

    return this._http.get<CompanyItemResultsInterface | SingleResult<CompanyItemInterface[]>>(url, { headers });
  }

  /**
   * Asocia un rubro del catálogo a una empresa tenant.
   */
  public saveCompanyItem(
    payload: { cmp_uuid: string; itm_uuid: string }
  ): Observable<CompanyItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<CompanyItemSingleResultInterface>(
      `${environment.apiUrl}company-item`,
      payload,
      { headers }
    );
  }

  /**
   * Desvincula un rubro asignado a una empresa.
   */
  public deleteCompanyItem(
    cmp_uuid: string,
    itm_uuid: string,
    cmpitm_uuid: string
  ): Observable<CompanyItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<CompanyItemSingleResultInterface>(
      `${environment.apiUrl}company-item/${cmp_uuid}/${itm_uuid}/${cmpitm_uuid}`,
      { headers }
    );
  }
}