import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ItemInterface,
  ItemResultsInterface,
  ItemSingleResultInterface
} from '@interfaces/item';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class ItemsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista completa de rubros/especialidades del catálogo maestro.
   */
  public getItems(
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<ItemResultsInterface | SingleResult<ItemInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}items`;

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

    return this._http.get<ItemResultsInterface | SingleResult<ItemInterface[]>>(url, { headers });
  }

  /**
   * Obtiene el detalle de un rubro maestro por UUID.
   */
  public getItemById(itm_uuid: string): Observable<ItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<ItemSingleResultInterface>(
      `${environment.apiUrl}item/${itm_uuid}`,
      { headers }
    );
  }

  /**
   * Registra un nuevo rubro en el catálogo maestro.
   */
  public saveItem(item: Partial<ItemInterface>): Observable<ItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<ItemSingleResultInterface>(
      `${environment.apiUrl}item`,
      item,
      { headers }
    );
  }

  /**
   * Actualiza un rubro existente.
   */
  public updateItem(
    itm_uuid: string,
    item: Partial<ItemInterface>
  ): Observable<ItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<ItemSingleResultInterface>(
      `${environment.apiUrl}item/${itm_uuid}`,
      item,
      { headers }
    );
  }

  /**
   * Da de baja un rubro del catálogo maestro.
   */
  public deleteItem(itm_uuid: string): Observable<ItemSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<ItemSingleResultInterface>(
      `${environment.apiUrl}item/${itm_uuid}`,
      { headers }
    );
  }
}
