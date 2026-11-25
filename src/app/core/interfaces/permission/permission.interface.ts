export interface PermissionInterface {
  per_uuid: string;
  per_slug: string;
  per_description?: string | null;
  rety_uuid?: string | null;
  remo_uuid?: string | null;
  per_createdat?: Date | string;
  per_updatedat?: Date | string;
}
