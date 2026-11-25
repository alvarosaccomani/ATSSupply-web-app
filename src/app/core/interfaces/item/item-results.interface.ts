import { PaginatedResult } from '@interfaces/common';
import { ItemInterface } from './item.interface';

export interface ItemResultsInterface extends PaginatedResult<ItemInterface> {}
