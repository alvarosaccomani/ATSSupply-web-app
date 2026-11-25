import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompanyMenuInterface,
  CompanyMenuSingleResult,
} from '@interfaces/company-menu';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root',
})
export class CompanyMenusService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getCompanyMenus(cmp_uuid: string): Observable<SingleResult<CompanyMenuInterface[]>> {
    return this.http.get<SingleResult<CompanyMenuInterface[]>>(
      `${this.apiUrl}company-menu/${cmp_uuid}`
    );
  }

  saveCompanyMenu(
    payload: Partial<CompanyMenuInterface>
  ): Observable<CompanyMenuSingleResult> {
    return this.http.post<CompanyMenuSingleResult>(
      `${this.apiUrl}company-menu`,
      payload
    );
  }

  updateCompanyMenu(
    cmpmnu_uuid: string,
    payload: Partial<CompanyMenuInterface>
  ): Observable<CompanyMenuSingleResult> {
    return this.http.put<CompanyMenuSingleResult>(
      `${this.apiUrl}company-menu/${cmpmnu_uuid}`,
      payload
    );
  }

  deleteCompanyMenu(cmpmnu_uuid: string): Observable<CompanyMenuSingleResult> {
    return this.http.delete<CompanyMenuSingleResult>(
      `${this.apiUrl}company-menu/${cmpmnu_uuid}`
    );
  }
}
