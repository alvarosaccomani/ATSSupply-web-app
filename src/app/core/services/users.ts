import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  UserInterface,
  UserResultsInterface,
  UserSingleResultInterface
} from '@interfaces/user';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista completa de usuarios registrados.
   */
  public getUsers(): Observable<SingleResult<UserInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<SingleResult<UserInterface[]>>(
      `${environment.apiUrl}users`,
      { headers }
    );
  }

  /**
   * Obtiene el detalle de un usuario por su UUID.
   */
  public getUserById(usr_uuid: string): Observable<UserSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<UserSingleResultInterface>(
      `${environment.apiUrl}user/${usr_uuid}`,
      { headers }
    );
  }

  /**
   * Registra un nuevo usuario en la base de datos.
   */
  public saveUser(user: Partial<UserInterface>): Observable<UserSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<UserSingleResultInterface>(
      `${environment.apiUrl}user`,
      user,
      { headers }
    );
  }

  /**
   * Actualiza los datos de un usuario existente.
   */
  public updateUser(
    usr_uuid: string,
    user: Partial<UserInterface>
  ): Observable<UserSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<UserSingleResultInterface>(
      `${environment.apiUrl}user/${usr_uuid}`,
      user,
      { headers }
    );
  }

  /**
   * Da de baja a un usuario del sistema.
   */
  public deleteUser(usr_uuid: string): Observable<UserSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<UserSingleResultInterface>(
      `${environment.apiUrl}user/${usr_uuid}`,
      { headers }
    );
  }
}