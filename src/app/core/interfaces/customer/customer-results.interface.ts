import { PaginatedResult } from '@interfaces/common';
import { CustomerInterface } from './customer.interface';

export interface CustomerResultsInterface extends PaginatedResult<CustomerInterface> {}
