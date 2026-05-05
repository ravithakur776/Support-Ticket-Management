import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppUser, UserRole, UsersListResponse, UserUpdatePayload, UserUpdateResponse } from '../../models/user.model';

interface UserListFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  list(filters: UserListFilters = {}): Observable<AppUser[]> {
    let params = new HttpParams();

    if (filters.role) {
      params = params.set('role', filters.role);
    }

    if (filters.isActive !== undefined) {
      params = params.set('isActive', String(filters.isActive));
    }

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    return this.http
      .get<UsersListResponse>(`${this.apiBaseUrl}/users`, { params, withCredentials: true })
      .pipe(map((response) => response.data.users));
  }

  updateById(userId: string, payload: UserUpdatePayload): Observable<AppUser> {
    return this.http
      .put<UserUpdateResponse>(`${this.apiBaseUrl}/users/${userId}`, payload, { withCredentials: true })
      .pipe(map((response) => response.data.user));
  }

  disableById(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/users/${userId}`, { withCredentials: true });
  }
}
