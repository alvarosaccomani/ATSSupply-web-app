export interface AuthUser {
  usr_uuid: string;
  usr_nick: string;
  usr_name: string;
  usr_surname: string;
  usr_email: string;
  usr_image?: string | null;
}

export interface AuthInterface {
  token: string;
  user?: AuthUser;
}

export interface LoginCredentials {
  usr_user: string;
  usr_password: string;
  gettoken?: boolean;
}
