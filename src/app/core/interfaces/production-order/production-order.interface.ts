export type ProductionOrderStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ProductionOrderInterface {
  cmp_uuid: string;
  prdord_uuid: string;
  mch_uuid?: string | null;
  prd_uuid: string;
  usr_uuid: string;
  prdord_producedqty: number;
  prdord_wasteqty: number;
  prdord_status: ProductionOrderStatus | string;
  prdord_productiondate: Date | string;
  prdord_notes?: string | null;
  prdord_createdat?: Date | string;
  prdord_updatedat?: Date | string;
}
