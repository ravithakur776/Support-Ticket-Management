import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, map, of, tap, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AppUser, UserRole } from '../../models/user.model';
import { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from '../../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly userSubject = new BehaviorSubject<AppUser | null>(null);

  readonly user$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.user$.pipe(map((user) => !!user));

  constructor(
    private readonly http: HttpClient,
    private readonly tokenStorage: TokenStorageService,
    private readonly router: Router,
  ) {}

  get currentUser(): AppUser | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser || this.tokenStorage.hasToken();
  }

  hasRole(roles: UserRole[]): boolean {
    const user = this.currentUser;
    if (!user) return false;
    return roles.includes(user.role);
  }

  getRoleLandingRoute(): string {
    const role = this.currentUser?.role;

    if (role === 'admin') {
      return '/users';
    }

    return '/tickets';
  }

  async bootstrapSession(): Promise<void> {
    await firstValueFrom(
      this.fetchCurrentUser().pipe(
        map(() => void 0),
        catchError(() => {
          this.clearSession(false);
          return of(void 0);
        }),
      ),
    );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, payload, { withCredentials: true })
      .pipe(tap((response) => this.hydrateSession(response)));
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, payload, { withCredentials: true })
      .pipe(tap((response) => this.hydrateSession(response)));
  }

  logout(navigateToLogin = true): Observable<void> {
    return this.http.post<void>(`${this.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearSession(navigateToLogin);
      }),
      catchError(() => {
        this.clearSession(navigateToLogin);
        return of(void 0);
      }),
    );
  }

  fetchCurrentUser(): Observable<AppUser | null> {
    return this.http.get<MeResponse>(`${this.apiBaseUrl}/auth/me`, { withCredentials: true }).pipe(
      map((response) => response.data.user),
      tap((user) => this.userSubject.next(user)),
      catchError(() => {
        this.userSubject.next(null);
        return of(null);
      }),
    );
  }

  private hydrateSession(response: AuthResponse): void {
    const token = response.data?.token;
    if (token) {
      this.tokenStorage.setToken(token);
    }

    this.userSubject.next(response.data.user);
  }

  private clearSession(navigateToLogin: boolean): void {
    this.tokenStorage.clearToken();
    this.userSubject.next(null);

    if (navigateToLogin) {
      this.router.navigate(['/login']);
    }
  }
}
