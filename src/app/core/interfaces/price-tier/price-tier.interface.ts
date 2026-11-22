export interface PriceTierInterface {
  cmp_uuid: string;
  prct_uuid: string;
  prct_code: string; // 'A' | 'B' | 'C'
  prct_name: string; // 'Mayorista' | 'Comercio' | 'Minorista'
  prct_description?: string | null;
  prct_isdefault: boolean;
  prct_active: boolean;
  prct_createdat?: Date | string;
  prct_updatedat?: Date | string;
}
