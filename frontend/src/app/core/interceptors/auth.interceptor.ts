import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const token = tokenStorage.getToken();
  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);

  if (!isApiRequest) {
    return next(req);
  }

  const headers = token ? req.headers.set('Authorization', `Bearer ${token}`) : req.headers;

  return next(
    req.clone({
      headers,
      withCredentials: true,
    }),
  );
};
