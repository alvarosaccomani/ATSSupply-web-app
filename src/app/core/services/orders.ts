import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrderCreateInput,
  OrderInterface,
  OrderResultsInterface,
  OrderSingleResultInterface
} from '@interfaces/order';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todos los pedidos de una empresa.
   */
  public getOrders(
    cmp_uuid: string,
    page?: number,
    perPage?: number
  ): Observable<OrderResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}orders/${cmp_uuid}`;
    if (page) {
      url += `/${page}`;
      if (perPage) {
        url += `/${perPage}`;
      }
    }
    return this._http.get<OrderResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle completo de un pedido incluyendo sus ítems.
   */
  public getOrderById(
    cmp_uuid: string,
    ord_uuid: string
  ): Observable<OrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<OrderSingleResultInterface>(
      `${environment.apiUrl}order/${cmp_uuid}/${ord_uuid}`,
      { headers }
    );
  }

  /**
   * Registra un nuevo pedido con sus detalles e impacta el stock/kardex en PostgreSQL.
   */
  public saveOrder(order: OrderCreateInput): Observable<OrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<OrderSingleResultInterface>(
      `${environment.apiUrl}order`,
      order,
      { headers }
    );
  }

  /**
   * Actualiza los datos o el estado de un pedido.
   */
  public updateOrder(
    cmp_uuid: string,
    ord_uuid: string,
    order: Partial<OrderInterface>
  ): Observable<OrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<OrderSingleResultInterface>(
      `${environment.apiUrl}order/${cmp_uuid}/${ord_uuid}`,
      order,
      { headers }
    );
  }

  /**
   * Elimina un pedido no entregado.
   */
  public deleteOrder(cmp_uuid: string, ord_uuid: string): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<any>(
      `${environment.apiUrl}order/${cmp_uuid}/${ord_uuid}`,
      { headers }
    );
  }
}
