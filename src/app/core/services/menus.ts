import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItemTree, MenuInterface, MenuResults, MenuSingleResult } from '@interfaces/menu';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root',
})
export class MenusService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getMenus(): Observable<MenuResults> {
    return this.http.get<MenuResults>(`${this.apiUrl}menus`);
  }

  getMenuTree(): Observable<SingleResult<MenuItemTree[]>> {
    return this.http.get<SingleResult<MenuItemTree[]>>(`${this.apiUrl}menu-tree`);
  }

  getMenuById(mnu_uuid: string): Observable<MenuSingleResult> {
    return this.http.get<MenuSingleResult>(`${this.apiUrl}menu/${mnu_uuid}`);
  }

  saveMenu(payload: Partial<MenuInterface>): Observable<MenuSingleResult> {
    return this.http.post<MenuSingleResult>(`${this.apiUrl}menu`, payload);
  }

  updateMenu(mnu_uuid: string, payload: Partial<MenuInterface>): Observable<MenuSingleResult> {
    return this.http.put<MenuSingleResult>(`${this.apiUrl}menu/${mnu_uuid}`, payload);
  }

  deleteMenu(mnu_uuid: string): Observable<MenuSingleResult> {
    return this.http.delete<MenuSingleResult>(`${this.apiUrl}menu/${mnu_uuid}`);
  }
}
