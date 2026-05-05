export type UserRole = 'user' | 'agent' | 'admin';

export interface AppUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface UsersListResponse {
  data: {
    count: number;
    users: AppUser[];
  };
}

export interface UserUpdateResponse {
  message: string;
  data: {
    user: AppUser;
  };
}
