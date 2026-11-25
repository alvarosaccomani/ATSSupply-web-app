import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RolInterface,
  RolResultsInterface,
  RolSingleResultInterface
} from '@interfaces/rol';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista de roles del sistema.
   */
  public getRoles(): Observable<SingleResult<RolInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<SingleResult<RolInterface[]>>(
      `${environment.apiUrl}roles`,
      { headers }
    );
  }

  /**
   * Obtiene el detalle de un rol por UUID.
   */
  public getRoleById(rol_uuid: string): Observable<RolSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<RolSingleResultInterface>(
      `${environment.apiUrl}rol/${rol_uuid}`,
      { headers }
    );
  }
}
