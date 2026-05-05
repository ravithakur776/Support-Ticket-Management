import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, RouterPreloader } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser } from '../../../models/user.model';
import { RealtimeService } from '../../../core/services/realtime.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-layout-shell',
  imports: [
    AsyncPipe,
    NgIf,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  templateUrl: './layout-shell.html',
  styleUrl: './layout-shell.scss',
})
export class LayoutShellComponent implements OnInit, OnDestroy {
  readonly user$: Observable<AppUser | null>;
  readonly isAdmin$: Observable<boolean>;
  readonly ticketNavLabel$: Observable<string>;
  readonly dashboardSubtitle$: Observable<string>;
  private readonly destroy$ = new Subject<void>();

  isMobileNav = false;
  realtimeEvents = 0;
  isRealtimeConnected = false;

  constructor(
    private readonly authService: AuthService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly routerPreloader: RouterPreloader,
  ) {
    this.user$ = this.authService.user$;
    this.isAdmin$ = this.user$.pipe(map((user) => user?.role === 'admin'));
    this.ticketNavLabel$ = this.user$.pipe(
      map((user) => {
        if (!user) return 'Tickets';
        if (user.role === 'admin') return 'All Tickets';
        if (user.role === 'agent') return 'Assigned Tickets';
        return 'My Tickets';
      }),
    );
    this.dashboardSubtitle$ = this.user$.pipe(
      map((user) => {
        if (!user) return '';
        if (user.role === 'admin') return 'System Command';
        if (user.role === 'agent') return 'Queue Operations';
        return 'Customer Care Portal';
      }),
    );
  }

  ngOnInit(): void {
    this.syncViewportState();
    this.routerPreloader.preload();
    this.realtimeService.connect();

    this.realtimeService.ready$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isRealtimeConnected = true;
      this.notificationService.info('Real-time updates connected.');
    });

    this.realtimeService.ticketUpdated$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.bumpRealtimeCounter();
      this.notificationService.info(`Ticket updated: ${event.ticket.title}`);
    });

    this.realtimeService.ticketCreated$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.bumpRealtimeCounter();
      this.notificationService.success(`New ticket created: ${event.ticket.title}`);
    });

    this.realtimeService.commentCreated$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.bumpRealtimeCounter();
      this.notificationService.info(`New comment on ticket ${event.ticketId.slice(0, 8)}`);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.realtimeService.disconnect();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.syncViewportState();
  }

  logout(): void {
    this.realtimeService.disconnect();
    this.authService.logout().subscribe();
  }

  clearRealtimeBadge(): void {
    this.realtimeEvents = 0;
  }

  openCreateTicket(): void {
    this.clearRealtimeBadge();
    this.router.navigate(['/tickets'], {
      queryParams: { create: '1' },
      queryParamsHandling: 'merge',
    });
  }

  private syncViewportState(): void {
    this.isMobileNav = window.innerWidth < 960;
  }

  private bumpRealtimeCounter(): void {
    this.realtimeEvents = Math.min(this.realtimeEvents + 1, 99);
  }
}
