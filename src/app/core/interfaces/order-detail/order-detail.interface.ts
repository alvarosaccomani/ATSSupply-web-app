export interface OrderDetailInterface {
  cmp_uuid: string;
  ord_uuid: string;
  ordd_uuid: string;
  prd_uuid: string;
  ordd_quantity: number;
  ordd_unitprice: number;
  ordd_subtotal: number;
  ordd_createdat?: Date | string;
  ordd_updatedat?: Date | string;
}
