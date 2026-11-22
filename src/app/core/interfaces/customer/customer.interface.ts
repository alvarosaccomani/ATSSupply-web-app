export interface CustomerInterface {
  cmp_uuid: string;
  cus_uuid: string;
  prct_uuid: string;
  cus_name: string;
  cus_address: string;
  cus_phone?: string | null;
  cus_contactname?: string | null;
  cus_notes?: string | null;
  cus_active: boolean;
  cus_createdat?: Date | string;
  cus_updatedat?: Date | string;
}
