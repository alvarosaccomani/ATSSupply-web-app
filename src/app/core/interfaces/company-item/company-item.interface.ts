import { ItemInterface } from '@interfaces/item';

export interface CompanyItemInterface {
  cmp_uuid: string;
  itm_uuid: string;
  itm?: ItemInterface;
  cmpitm_uuid: string;
  cmpitm_createdat?: Date | string;
  cmpitm_updatedat?: Date | string;
}
