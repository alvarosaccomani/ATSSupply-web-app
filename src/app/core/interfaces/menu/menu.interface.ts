export interface MenuInterface {
  mnu_uuid: string;
  mnu_parent_uuid?: string | null;
  mnu_cod?: string | null;
  mnu_title: string;
  mnu_description?: string | null;
  mnu_icon?: string | null;
  mnu_route?: string | null;
  mnu_order: number;
  mnu_itemactive: boolean;
  mnu_active: boolean;
  mnu_showifcompanyactive: boolean;
  per_uuid?: string | null;
  mnu_showondashboard?: boolean;
  mnu_dashboardicon?: string | null;
  mnu_dashboardtitle?: string | null;
  mnu_createdat?: Date | string;
  mnu_updatedat?: Date | string;
}

export interface MenuItemTree extends MenuInterface {
  items?: MenuItemTree[];
}
