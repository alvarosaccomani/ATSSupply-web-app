export type OrderStatus =
  | 'PENDIENTE_DE_ENTREGA'
  | 'ENTREGADO_DEBE'
  | 'PAGADO'
  | 'CUENTA_CORRIENTE'
  | 'CANCELADO';

export interface OrderInterface {
  cmp_uuid: string;
  ord_uuid: string;
  cus_uuid: string;
  usr_uuid_seller: string;
  usr_uuid_driver?: string | null;
  ord_orderdate: Date | string;
  ord_deliverydate?: Date | string | null;
  ord_status: OrderStatus | string;
  ord_totalamount: number;
  ord_notes?: string | null;
  ord_createdat?: Date | string;
  ord_updatedat?: Date | string;
}
