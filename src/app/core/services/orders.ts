import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrderCreateInput,
  OrderInterface,
  OrderResultsInterface,
  OrderSingleResultInterface
} from '@interfaces/order';

export interface OrderFilters {
  status?: string;
  cus_uuid?: string;
  usr_uuid_seller?: string;
  usr_uuid_driver?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todos los pedidos de una empresa con filtros opcionales y paginación.
   */
  public getOrders(
    cmp_uuid: string,
    filters?: OrderFilters | number,
    perPage?: number
  ): Observable<OrderResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}orders/${cmp_uuid}`;
    let params = new HttpParams();

    if (typeof filters === 'number') {
      const page = filters;
      url += `/${page}`;
      if (perPage) {
        url += `/${perPage}`;
      }
    } else if (filters && typeof filters === 'object') {
      if (filters.status) params = params.set('status', filters.status);
      if (filters.cus_uuid) params = params.set('cus_uuid', filters.cus_uuid);
      if (filters.usr_uuid_seller) params = params.set('usr_uuid_seller', filters.usr_uuid_seller);
      if (filters.usr_uuid_driver) params = params.set('usr_uuid_driver', filters.usr_uuid_driver);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
      if (filters.page) params = params.set('page', filters.page.toString());
      if (filters.perPage) params = params.set('perPage', filters.perPage.toString());
    }

    return this._http.get<OrderResultsInterface>(url, { headers, params });
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
   * Asigna o reasigna un chofer a uno o varios pedidos.
   */
  public assignDriverToOrders(
    cmp_uuid: string,
    ord_uuids: string[],
    usr_uuid_driver: string | null
  ): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<any>(
      `${environment.apiUrl}orders/assign-driver`,
      { cmp_uuid, ord_uuids, usr_uuid_driver },
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
