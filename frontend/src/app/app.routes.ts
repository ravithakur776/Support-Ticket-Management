import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/auth/register/register').then((m) => m.RegisterComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./components/shared/forbidden/forbidden').then((m) => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/shared/layout-shell/layout-shell').then((m) => m.LayoutShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./components/shared/home/home').then((m) => m.HomeComponent),
      },
      {
        path: 'tickets',
        loadComponent: () => import('./components/ticket/ticket-list/ticket-list').then((m) => m.TicketListComponent),
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./components/ticket/ticket-detail/ticket-detail').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./components/user/user-list/user-list').then((m) => m.UserListComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./components/shared/not-found/not-found').then((m) => m.NotFoundComponent),
  },
];
