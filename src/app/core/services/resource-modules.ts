import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ResourceModuleInterface,
  ResourceModuleResults,
  ResourceModuleSingleResult,
} from '@interfaces/resource-module';

@Injectable({
  providedIn: 'root',
})
export class ResourceModulesService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getResourceModules(
    filter: string = '',
    page: number = 1,
    perPage: number = 100
  ): Observable<ResourceModuleResults> {
    const encodedFilter = filter ? encodeURIComponent(filter) : '';
    const endpoint = encodedFilter
      ? `${this.apiUrl}resources-modules/${encodedFilter}/${page}/${perPage}`
      : `${this.apiUrl}resources-modules`;
    return this.http.get<ResourceModuleResults>(endpoint);
  }

  getResourceModuleById(remo_uuid: string): Observable<ResourceModuleSingleResult> {
    return this.http.get<ResourceModuleSingleResult>(
      `${this.apiUrl}resource-module/${remo_uuid}`
    );
  }

  saveResourceModule(
    payload: Partial<ResourceModuleInterface>
  ): Observable<ResourceModuleSingleResult> {
    return this.http.post<ResourceModuleSingleResult>(
      `${this.apiUrl}resource-module`,
      payload
    );
  }

  updateResourceModule(
    remo_uuid: string,
    payload: Partial<ResourceModuleInterface>
  ): Observable<ResourceModuleSingleResult> {
    return this.http.put<ResourceModuleSingleResult>(
      `${this.apiUrl}resource-module/${remo_uuid}`,
      payload
    );
  }

  deleteResourceModule(remo_uuid: string): Observable<ResourceModuleSingleResult> {
    return this.http.delete<ResourceModuleSingleResult>(
      `${this.apiUrl}resource-module/${remo_uuid}`
    );
  }
}
