import { PaginatedResult } from '@interfaces/common';
import { OrderHistoryInterface } from './order-history.interface';

export interface OrderHistoryResultsInterface extends PaginatedResult<OrderHistoryInterface> {}
