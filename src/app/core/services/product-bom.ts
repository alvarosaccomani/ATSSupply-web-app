import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductBomInterface } from '@interfaces/product-bom';

export interface RecipeItemInput {
  prd_uuid_supply: string;
  prdbom_quantityperunit: number;
}

export interface RecipeResponse {
  success: boolean;
  message?: string;
  data: (ProductBomInterface & {
    supplyProduct?: {
      prd_uuid: string;
      prd_code?: string | null;
      prd_name: string;
    };
  })[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductBomService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la receta completa (BOM) de un producto terminado.
   */
  public getRecipe(cmp_uuid: string, prd_uuid_finished: string): Observable<RecipeResponse> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}product-bom/recipe/${cmp_uuid}/${prd_uuid_finished}`;
    return this._http.get<RecipeResponse>(url, { headers });
  }

  /**
   * Guarda o reemplaza en lote la receta completa (BOM) de un producto terminado.
   */
  public setFullRecipe(
    cmp_uuid: string,
    prd_uuid_finished: string,
    items: RecipeItemInput[]
  ): Observable<RecipeResponse> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    const url = `${environment.apiUrl}product-bom/recipe/${cmp_uuid}/${prd_uuid_finished}`;
    return this._http.put<RecipeResponse>(url, { items }, { headers });
  }
}
