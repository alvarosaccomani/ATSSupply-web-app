import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CustomerInterface,
  CustomerResultsInterface,
  CustomerSingleResultInterface
} from '@interfaces/customer';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista de clientes paginada para una compañía con soporte de filtros.
   */
  public getCustomers(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<CustomerResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}customers/${cmp_uuid}`;
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

    return this._http.get<CustomerResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle de un cliente específico por UUID.
   */
  public getCustomerById(
    cmp_uuid: string,
    cus_uuid: string
  ): Observable<CustomerSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<CustomerSingleResultInterface>(
      `${environment.apiUrl}customer/${cmp_uuid}/${cus_uuid}`,
      { headers }
    );
  }

  /**
   * Registra un nuevo cliente en el sistema.
   */
  public saveCustomer(
    customer: Partial<CustomerInterface>
  ): Observable<CustomerSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<CustomerSingleResultInterface>(
      `${environment.apiUrl}customer`,
      customer,
      { headers }
    );
  }

  /**
   * Actualiza los datos de un cliente existente.
   */
  public updateCustomer(
    cmp_uuid: string,
    cus_uuid: string,
    customer: Partial<CustomerInterface>
  ): Observable<CustomerSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<CustomerSingleResultInterface>(
      `${environment.apiUrl}customer/${cmp_uuid}/${cus_uuid}`,
      customer,
      { headers }
    );
  }

  /**
   * Elimina un cliente por su UUID.
   */
  public deleteCustomer(
    cmp_uuid: string,
    cus_uuid: string
  ): Observable<{ success: boolean; message: string }> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<{ success: boolean; message: string }>(
      `${environment.apiUrl}customer/${cmp_uuid}/${cus_uuid}`,
      { headers }
    );
  }
}
