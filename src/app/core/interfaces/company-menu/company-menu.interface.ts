import { MenuInterface } from '../menu/menu.interface';

export interface CompanyMenuInterface {
  cmp_uuid: string;
  mnu_uuid: string;
  menu?: MenuInterface;
  cmpmnu_uuid: string;
  cmpmnu_title?: string | null;
  cmpmnu_description?: string | null;
  cmpmnu_icon?: string | null;
  cmpmnu_order?: number | null;
  cmpmnu_showondashboard?: boolean | null;
  cmpmnu_dashboardtitle?: string | null;
  cmpmnu_dashboardicon?: string | null;
  cmpmnu_active?: boolean | null;
  cmpmnu_createdat?: Date | string;
  cmpmnu_updatedat?: Date | string;
}
