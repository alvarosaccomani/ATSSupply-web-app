import { PaginatedResult } from '@interfaces/common';
import { ProductInterface } from './product.interface';

export interface ProductResultsInterface extends PaginatedResult<ProductInterface> {}
