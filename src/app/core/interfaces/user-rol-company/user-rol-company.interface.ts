export interface UserRolCompanyInterface {
  cmp_uuid: string;
  usr_uuid: string;
  rol_uuid: string;
  rol_name?: string;
  usr_name?: string;
  cmp_name?: string;
  usr?: {
    usr_uuid: string;
    usr_name: string;
    usr_surname?: string;
    usr_email?: string;
    usr_nick?: string;
    usr_phone?: string;
  };
  rol?: {
    rol_uuid: string;
    rol_name: string;
  };
  usrrolcmp_createdat?: Date | string;
  usrrolcmp_updatedat?: Date | string;
}
