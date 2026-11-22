export interface ProductBomInterface {
  cmp_uuid: string;
  prdbom_uuid: string;
  prd_uuid_finished: string;
  prd_uuid_supply: string;
  prdbom_quantityperunit: number;
  prdbom_createdat?: Date | string;
  prdbom_updatedat?: Date | string;
}
