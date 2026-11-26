import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderHistoryInterface } from '@interfaces/order-history';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class OrderHistoryService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la cronología completa de transiciones de estado de un pedido.
   */
  public getOrderHistory(
    cmp_uuid: string,
    ord_uuid: string
  ): Observable<SingleResult<OrderHistoryInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}order-history/${cmp_uuid}/${ord_uuid}`;
    return this._http.get<SingleResult<OrderHistoryInterface[]>>(url, { headers });
  }
}
