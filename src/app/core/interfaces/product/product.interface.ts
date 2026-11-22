export type ProductType = 'FINISHED' | 'SUPPLY';

export interface ProductInterface {
  cmp_uuid: string;
  prd_uuid: string;
  prd_code?: string | null;
  prd_name: string;
  prd_type: ProductType | string;
  prd_unitlabel: string;
  prd_weightorvolume?: number | null;
  prd_currentstock: number;
  prd_minstockalert: number;
  prd_active: boolean;
  prd_createdat?: Date | string;
  prd_updatedat?: Date | string;
}
