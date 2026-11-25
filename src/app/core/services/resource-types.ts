import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ResourceTypeInterface,
  ResourceTypeResults,
  ResourceTypeSingleResult,
} from '@interfaces/resource-type';

@Injectable({
  providedIn: 'root',
})
export class ResourceTypesService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getResourceTypes(
    filter: string = '',
    page: number = 1,
    perPage: number = 100
  ): Observable<ResourceTypeResults> {
    const encodedFilter = filter ? encodeURIComponent(filter) : '';
    const endpoint = encodedFilter
      ? `${this.apiUrl}resources-types/${encodedFilter}/${page}/${perPage}`
      : `${this.apiUrl}resources-types`;
    return this.http.get<ResourceTypeResults>(endpoint);
  }

  getResourceTypeById(rety_uuid: string): Observable<ResourceTypeSingleResult> {
    return this.http.get<ResourceTypeSingleResult>(
      `${this.apiUrl}resource-type/${rety_uuid}`
    );
  }

  saveResourceType(
    payload: Partial<ResourceTypeInterface>
  ): Observable<ResourceTypeSingleResult> {
    return this.http.post<ResourceTypeSingleResult>(
      `${this.apiUrl}resource-type`,
      payload
    );
  }

  updateResourceType(
    rety_uuid: string,
    payload: Partial<ResourceTypeInterface>
  ): Observable<ResourceTypeSingleResult> {
    return this.http.put<ResourceTypeSingleResult>(
      `${this.apiUrl}resource-type/${rety_uuid}`,
      payload
    );
  }

  deleteResourceType(rety_uuid: string): Observable<ResourceTypeSingleResult> {
    return this.http.delete<ResourceTypeSingleResult>(
      `${this.apiUrl}resource-type/${rety_uuid}`
    );
  }
}
