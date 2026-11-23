import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProductInterface,
  ProductResultsInterface,
  ProductSingleResultInterface
} from '@interfaces/product';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todos los productos de una empresa con su stock y matriz de precios por categoría.
   */
  public getProducts(
    cmp_uuid: string,
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<ProductResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}products/${cmp_uuid}`;
    if (filter) {
      url += `/${filter}`;
      if (page) {
        url += `/${page}`;
        if (perPage) {
          url += `/${perPage}`;
        }
      }
    }
    return this._http.get<ProductResultsInterface>(url, { headers });
  }

  /**
   * Obtiene el detalle de un producto por clave compuesta.
   */
  public getProductById(
    cmp_uuid: string,
    prd_uuid: string
  ): Observable<ProductSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<ProductSingleResultInterface>(
      `${environment.apiUrl}product/${cmp_uuid}/${prd_uuid}`,
      { headers }
    );
  }

  /**
   * Crea un nuevo producto.
   */
  public saveProduct(product: Partial<ProductInterface>): Observable<ProductSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<ProductSingleResultInterface>(
      `${environment.apiUrl}product`,
      product,
      { headers }
    );
  }

  /**
   * Actualiza los datos de un producto.
   */
  public updateProduct(
    cmp_uuid: string,
    prd_uuid: string,
    product: Partial<ProductInterface>
  ): Observable<ProductSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<ProductSingleResultInterface>(
      `${environment.apiUrl}product/${cmp_uuid}/${prd_uuid}`,
      product,
      { headers }
    );
  }

  /**
   * Elimina un producto.
   */
  public deleteProduct(cmp_uuid: string, prd_uuid: string): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<any>(
      `${environment.apiUrl}product/${cmp_uuid}/${prd_uuid}`,
      { headers }
    );
  }
}
