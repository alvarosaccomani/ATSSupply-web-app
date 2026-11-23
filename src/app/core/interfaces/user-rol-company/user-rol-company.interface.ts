export interface UserRolCompanyInterface {
  cmp_uuid: string;
  usr_uuid: string;
  rol_uuid: string;
  rol_name?: string;
  usr_name?: string;
  cmp_name?: string;
  usrrolcmp_createdat?: Date | string;
  usrrolcmp_updatedat?: Date | string;
}
