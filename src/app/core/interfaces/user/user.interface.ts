export interface UserInterface {
  usr_uuid: string;
  usr_name: string;
  usr_surname: string;
  usr_password?: string;
  usr_image?: string | null;
  usr_email: string;
  usr_nick: string;
  usr_bio?: string | null;
  usr_socket?: string | null;
  usr_online?: boolean;
  usr_createdat?: Date | string;
  usr_updatedat?: Date | string;
}
