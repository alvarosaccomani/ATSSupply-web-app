import { OrderDetailInterface } from '../order-detail/order-detail.interface';
import { CustomerInterface } from '../customer/customer.interface';

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
  ord_paidamount?: number;
  ord_notes?: string | null;
  ord_createdat?: Date | string;
  ord_updatedat?: Date | string;
  customer?: CustomerInterface;
  details?: OrderDetailInterface[];
}

export interface OrderCreateInput {
  cmp_uuid: string;
  ord_uuid?: string;
  cus_uuid: string;
  usr_uuid_seller: string;
  usr_uuid_driver?: string | null;
  ord_orderdate?: Date | string;
  ord_deliverydate?: Date | string | null;
  ord_status?: OrderStatus | string;
  ord_notes?: string | null;
  details: {
    prd_uuid: string;
    ordd_quantity: number;
    ordd_unitprice: number;
    ordd_subtotal?: number;
  }[];
}
