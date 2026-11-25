import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompanyInterface,
  CompanyResultsInterface,
  CompanySingleResultInterface
} from '@interfaces/company';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class CompaniesService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista de empresas registradas (con soporte de filtros y paginación opcional).
   */
  public getCompanies(
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<CompanyResultsInterface | SingleResult<CompanyInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}companies`;

    if (filter) {
      url += `/${encodeURIComponent(filter)}`;
      if (page !== undefined) {
        url += `/${page}`;
        if (perPage !== undefined) {
          url += `/${perPage}`;
        }
      }
    } else if (page !== undefined && perPage !== undefined) {
      url += `?page=${page}&perPage=${perPage}`;
    }

    return this._http.get<CompanyResultsInterface | SingleResult<CompanyInterface[]>>(url, { headers });
  }

  /**
   * Obtiene el detalle de una empresa por su UUID.
   */
  public getCompanyById(cmp_uuid: string): Observable<CompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<CompanySingleResultInterface>(
      `${environment.apiUrl}company/${cmp_uuid}`,
      { headers }
    );
  }

  /**
   * Registra una nueva empresa tenant en el sistema.
   */
  public saveCompany(
    company: Partial<CompanyInterface>
  ): Observable<CompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<CompanySingleResultInterface>(
      `${environment.apiUrl}company`,
      company,
      { headers }
    );
  }

  /**
   * Actualiza los datos de una empresa existente.
   */
  public updateCompany(
    cmp_uuid: string,
    company: Partial<CompanyInterface>
  ): Observable<CompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<CompanySingleResultInterface>(
      `${environment.apiUrl}company/${cmp_uuid}`,
      company,
      { headers }
    );
  }

  /**
   * Da de baja o elimina una empresa.
   */
  public deleteCompany(cmp_uuid: string): Observable<CompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<CompanySingleResultInterface>(
      `${environment.apiUrl}company/${cmp_uuid}`,
      { headers }
    );
  }
}
