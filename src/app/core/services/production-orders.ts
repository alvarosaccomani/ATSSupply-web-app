import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProductionOrderInterface,
  ProductionOrderResultsInterface,
  ProductionOrderSingleResultInterface
} from '@interfaces/production-order';

@Injectable({
  providedIn: 'root'
})
export class ProductionOrderService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todas las órdenes de producción de una empresa.
   */
  public getProductionOrders(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<ProductionOrderResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}production-orders/${cmp_uuid}`;
    if (filter) {
      url += `/${filter}`;
    }
    if (page) {
      url += `/${page}`;
      if (perPage) {
        url += `/${perPage}`;
      }
    }
    return this._http.get<ProductionOrderResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle de una orden de producción por su UUID.
   */
  public getProductionOrderById(
    cmp_uuid: string,
    prdord_uuid: string
  ): Observable<ProductionOrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<ProductionOrderSingleResultInterface>(
      `${environment.apiUrl}production-order/${cmp_uuid}/${prdord_uuid}`,
      { headers }
    );
  }

  /**
   * Registra una nueva orden o lote de producción.
   */
  public saveProductionOrder(
    productionOrder: Partial<ProductionOrderInterface>
  ): Observable<ProductionOrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<ProductionOrderSingleResultInterface>(
      `${environment.apiUrl}production-order`,
      productionOrder,
      { headers }
    );
  }

  /**
   * Actualiza el estado o datos de una orden de producción.
   */
  public updateProductionOrder(
    cmp_uuid: string,
    prdord_uuid: string,
    productionOrder: Partial<ProductionOrderInterface>
  ): Observable<ProductionOrderSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<ProductionOrderSingleResultInterface>(
      `${environment.apiUrl}production-order/${cmp_uuid}/${prdord_uuid}`,
      productionOrder,
      { headers }
    );
  }

  /**
   * Elimina una orden de producción.
   */
  public deleteProductionOrder(cmp_uuid: string, prdord_uuid: string): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<any>(
      `${environment.apiUrl}production-order/${cmp_uuid}/${prdord_uuid}`,
      { headers }
    );
  }
}
