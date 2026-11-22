export interface MachineInterface {
  cmp_uuid: string;
  mch_uuid: string;
  mch_name: string;
  mch_description?: string | null;
  mch_dailycapacity?: number | null;
  mch_active: boolean;
  mch_createdat?: Date | string;
  mch_updatedat?: Date | string;
}
