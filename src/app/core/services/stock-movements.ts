import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  StockMovementInterface,
  StockMovementResultsInterface,
  StockMovementSingleResultInterface
} from '@interfaces/stock-movement';

export interface StockMovementFilters {
  prd_uuid?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  perPage?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockMovementsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene los movimientos de stock / kardex para una compañía con filtros opcionales.
   */
  public getStockMovements(
    cmp_uuid: string,
    filters?: StockMovementFilters
  ): Observable<StockMovementResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let params = new HttpParams();

    if (filters) {
      if (filters.prd_uuid) params = params.set('prd_uuid', filters.prd_uuid);
      if (filters.type) params = params.set('type', filters.type);
      if (filters.start_date) params = params.set('start_date', filters.start_date);
      if (filters.end_date) params = params.set('end_date', filters.end_date);
      if (filters.page) params = params.set('page', filters.page.toString());
      if (filters.perPage) params = params.set('perPage', filters.perPage.toString());
    }

    return this._http.get<StockMovementResultsInterface>(
      `${environment.apiUrl}stock-movements/${cmp_uuid}`,
      { headers, params }
    );
  }

  /**
   * Obtiene el detalle de un movimiento de stock por su UUID.
   */
  public getStockMovementById(
    cmp_uuid: string,
    stkm_uuid: string
  ): Observable<StockMovementSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<StockMovementSingleResultInterface>(
      `${environment.apiUrl}stock-movement/${cmp_uuid}/${stkm_uuid}`,
      { headers }
    );
  }

  /**
   * Registra un nuevo movimiento de stock (manual, ajuste de inventario, etc.)
   */
  public saveStockMovement(
    movement: Partial<StockMovementInterface>
  ): Observable<StockMovementSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<StockMovementSingleResultInterface>(
      `${environment.apiUrl}stock-movement`,
      movement,
      { headers }
    );
  }

  /**
   * Despacha la carga de la camioneta descontando de cámara el consolidado de estiba.
   */
  public dispatchTruckLoad(
    cmp_uuid: string,
    items: { prd_uuid: string; quantity: number }[],
    notes?: string
  ): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<any>(
      `${environment.apiUrl}delivery/dispatch-load`,
      { cmp_uuid, items, notes },
      { headers }
    );
  }

  /**
   * Reingresa a la cámara el sobrante no entregado al regreso del vehículo.
   */
  public reconcileTruckReturn(
    cmp_uuid: string,
    items: { prd_uuid: string; quantity: number }[],
    notes?: string
  ): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<any>(
      `${environment.apiUrl}delivery/reconcile-return`,
      { cmp_uuid, items, notes },
      { headers }
    );
  }
}
