import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CustomerMovementInterface,
  CustomerMovementResultsInterface,
  CustomerMovementSingleResultInterface,
  RegisterPaymentDTO
} from '@interfaces/customer-movement';
import { SingleResult } from '@interfaces/common';

export interface CustomerMovementFilters {
  type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  perPage?: number;
}

export interface CustomerBalanceResponse {
  cus_uuid: string;
  cus_name: string;
  cus_currentbalance: number;
  cus_hascredit: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerMovementsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene los movimientos de cuenta corriente de un cliente con paginación y filtros opcionales.
   */
  public getMovements(
    cmp_uuid: string,
    cus_uuid: string,
    filters?: CustomerMovementFilters
  ): Observable<CustomerMovementResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let params = new HttpParams();

    let url = `${environment.apiUrl}customer-movements/${cmp_uuid}/${cus_uuid}`;

    if (filters) {
      if (filters.page !== undefined && filters.perPage !== undefined) {
        url += `/${filters.page}/${filters.perPage}`;
      }
      if (filters.type) params = params.set('type', filters.type);
      if (filters.start_date) params = params.set('start_date', filters.start_date);
      if (filters.end_date) params = params.set('end_date', filters.end_date);
    }

    return this._http.get<CustomerMovementResultsInterface>(url, { headers, params });
  }

  /**
   * Obtiene el saldo actual y estado de cuenta corriente de un cliente.
   */
  public getCustomerBalance(
    cmp_uuid: string,
    cus_uuid: string
  ): Observable<SingleResult<CustomerBalanceResponse>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}customer-balance/${cmp_uuid}/${cus_uuid}`;
    return this._http.get<SingleResult<CustomerBalanceResponse>>(url, { headers });
  }

  /**
   * Registra una cobranza o pago hacia la cuenta corriente del cliente.
   */
  public registerPayment(
    data: RegisterPaymentDTO
  ): Observable<CustomerMovementSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}customer-movement/payment`;
    return this._http.post<CustomerMovementSingleResultInterface>(url, data, { headers });
  }

  /**
   * Registra un movimiento manual (ajuste débito o crédito) en la cuenta corriente.
   */
  public registerMovement(
    data: {
      cmp_uuid?: string;
      cus_uuid: string;
      type: string;
      amount: number;
      ord_uuid?: string | null;
      payment_method?: string | null;
      receipt_number?: string | null;
      notes?: string | null;
    }
  ): Observable<CustomerMovementSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}customer-movement`;
    return this._http.post<CustomerMovementSingleResultInterface>(url, data, { headers });
  }
}
