import { PaginatedResult } from '@interfaces/common';
import { UserInterface } from './user.interface';

export interface UserResultsInterface extends PaginatedResult<UserInterface> {}
