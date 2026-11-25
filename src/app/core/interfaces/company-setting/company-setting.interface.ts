export interface CompanySettingInterface {
  cmp_uuid: string;
  cmps_uuid: string;
  cmps_key: string;
  cmps_parameter: string;
  cmps_description?: string | null;
  cmps_value: string;
  cmps_datatype?: string | null;
  dtp_uuid?: string | null;
  cmps_options?: string | null;
  cmps_group?: string | null;
  cmps_createdat?: Date | string;
  cmps_updatedat?: Date | string;
}
