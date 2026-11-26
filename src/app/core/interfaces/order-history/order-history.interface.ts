export interface OrderHistoryInterface {
  cmp_uuid: string;
  ordh_uuid: string;
  ord_uuid: string;
  usr_uuid: string;
  ordh_previousstatus: string | null;
  ordh_newstatus: string;
  ordh_notes?: string | null;
  ordh_createdat: Date | string;
  ordh_updatedat?: Date | string;
  user?: {
    usr_uuid: string;
    usr_name: string;
    usr_surname: string;
    usr_email?: string;
  };
}
