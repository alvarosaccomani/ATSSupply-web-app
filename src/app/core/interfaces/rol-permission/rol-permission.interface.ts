import { RolInterface } from '@interfaces/rol';
import { PermissionInterface } from '@interfaces/permission';

export interface RolPermissionInterface {
  rol_uuid: string;
  rol?: RolInterface;
  per_uuid: string;
  per?: PermissionInterface;
  rolper_createdat?: Date | string;
  rolper_updatedat?: Date | string;
}
