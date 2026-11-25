import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompanySettingInterface,
  CompanySettingResults,
  CompanySettingSingleResult,
} from '@interfaces/company-setting';

@Injectable({
  providedIn: 'root',
})
export class CompanySettingsService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getCompanySettings(
    cmp_uuid: string,
    filter: string = '',
    page: number = 1,
    perPage: number = 50
  ): Observable<CompanySettingResults> {
    const encodedFilter = filter ? encodeURIComponent(filter) : '';
    const endpoint = encodedFilter
      ? `${this.apiUrl}companies-settings/${cmp_uuid}/${encodedFilter}/${page}/${perPage}`
      : `${this.apiUrl}companies-settings/${cmp_uuid}`;
    return this.http.get<CompanySettingResults>(endpoint);
  }

  getCompanySettingById(
    cmp_uuid: string,
    cmps_uuid: string
  ): Observable<CompanySettingSingleResult> {
    return this.http.get<CompanySettingSingleResult>(
      `${this.apiUrl}company-setting/${cmp_uuid}/${cmps_uuid}`
    );
  }

  saveCompanySetting(
    payload: Partial<CompanySettingInterface>
  ): Observable<CompanySettingSingleResult> {
    return this.http.post<CompanySettingSingleResult>(
      `${this.apiUrl}company-setting`,
      payload
    );
  }

  updateCompanySetting(
    cmp_uuid: string,
    cmps_uuid: string,
    payload: Partial<CompanySettingInterface>
  ): Observable<CompanySettingSingleResult> {
    return this.http.put<CompanySettingSingleResult>(
      `${this.apiUrl}company-setting/${cmp_uuid}/${cmps_uuid}`,
      payload
    );
  }

  deleteCompanySetting(
    cmp_uuid: string,
    cmps_uuid: string
  ): Observable<CompanySettingSingleResult> {
    return this.http.delete<CompanySettingSingleResult>(
      `${this.apiUrl}company-setting/${cmp_uuid}/${cmps_uuid}`
    );
  }
}
