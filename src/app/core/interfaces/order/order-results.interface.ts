import { PaginatedResult } from '@interfaces/common';
import { OrderInterface } from './order.interface';

export interface OrderResultsInterface extends PaginatedResult<OrderInterface> {}
