import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MachineInterface,
  MachineResultsInterface,
  MachineSingleResultInterface
} from '@interfaces/machine';

@Injectable({
  providedIn: 'root'
})
export class MachineService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todas las máquinas y líneas de producción de una empresa.
   */
  public getMachines(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<MachineResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}machines/${cmp_uuid}`;
    if (filter) {
      url += `/${filter}`;
    }
    if (page) {
      url += `/${page}`;
      if (perPage) {
        url += `/${perPage}`;
      }
    }
    return this._http.get<MachineResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle de una máquina por su UUID.
   */
  public getMachineById(
    cmp_uuid: string,
    mch_uuid: string
  ): Observable<MachineSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<MachineSingleResultInterface>(
      `${environment.apiUrl}machine/${cmp_uuid}/${mch_uuid}`,
      { headers }
    );
  }

  /**
   * Registra una nueva máquina o línea de producción.
   */
  public saveMachine(machine: Partial<MachineInterface>): Observable<MachineSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<MachineSingleResultInterface>(
      `${environment.apiUrl}machine`,
      machine,
      { headers }
    );
  }

  /**
   * Actualiza los datos de una máquina existente.
   */
  public updateMachine(
    cmp_uuid: string,
    mch_uuid: string,
    machine: Partial<MachineInterface>
  ): Observable<MachineSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<MachineSingleResultInterface>(
      `${environment.apiUrl}machine/${cmp_uuid}/${mch_uuid}`,
      machine,
      { headers }
    );
  }

  /**
   * Elimina una máquina por su UUID.
   */
  public deleteMachine(cmp_uuid: string, mch_uuid: string): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<any>(
      `${environment.apiUrl}machine/${cmp_uuid}/${mch_uuid}`,
      { headers }
    );
  }
}
