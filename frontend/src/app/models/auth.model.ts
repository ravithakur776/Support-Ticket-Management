import { AppUser } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthPayload {
  token?: string;
  user: AppUser;
}

export interface AuthResponse {
  message: string;
  data: AuthPayload;
}

export interface MeResponse {
  data: {
    user: AppUser;
  };
}
