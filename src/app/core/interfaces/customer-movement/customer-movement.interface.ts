export type CustomerMovementType =
  | 'ORDER_DEBIT'
  | 'PAYMENT_CREDIT'
  | 'ADJUSTMENT_DEBIT'
  | 'ADJUSTMENT_CREDIT'
  | 'CANCEL_CREDIT';

export interface CustomerMovementInterface {
  cmp_uuid: string;
  cusm_uuid: string;
  cus_uuid: string;
  usr_uuid: string;
  cusm_type: CustomerMovementType | string;
  cusm_amount: number;
  cusm_previousbalance: number;
  cusm_newbalance: number;
  ord_uuid?: string | null;
  cusm_paymentmethod?: string | null;
  cusm_receiptnumber?: string | null;
  cusm_notes?: string | null;
  cusm_createdat?: Date | string;
  cusm_updatedat?: Date | string;
  customer?: {
    cus_uuid: string;
    cus_name: string;
    cus_address?: string;
    cus_currentbalance?: number;
  };
  user?: {
    usr_uuid: string;
    usr_name: string;
    usr_surname: string;
  };
  order?: {
    ord_uuid: string;
    ord_totalamount: number;
    ord_status: string;
  };
}

export interface RegisterPaymentDTO {
  cmp_uuid?: string;
  cus_uuid: string;
  amount: number;
  payment_method?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
}
