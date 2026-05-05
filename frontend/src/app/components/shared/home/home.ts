import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, NgFor, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subject, merge } from 'rxjs';
import { auditTime, takeUntil } from 'rxjs/operators';
import { Ticket, TicketPriority, TicketStatus } from '../../../models/ticket.model';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { RealtimeService } from '../../../core/services/realtime.service';

interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'neutral' | 'accent' | 'warn' | 'success';
}

interface StatusSegment {
  label: string;
  value: number;
  percentage: number;
  css: string;
}

@Component({
  selector: 'app-home',
  imports: [NgFor, NgClass, DatePipe, DecimalPipe, TitleCasePipe, MatCardModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly destroy$ = new Subject<void>();

  isLoading = true;
  errorMessage = '';
  roleLabel = '';
  summaryMetrics: DashboardMetric[] = [];
  statusSegments: StatusSegment[] = [];
  recentTickets: Ticket[] = [];
  riskTickets: Array<Ticket & { ageHours: number }> = [];

  ngOnInit(): void {
    this.roleLabel = this.getRoleLabel();
    this.loadDashboardData();

    merge(
      this.realtimeService.ticketUpdated$,
      this.realtimeService.ticketCreated$,
      this.realtimeService.commentCreated$,
    )
      .pipe(auditTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.loadDashboardData());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByMetricLabel(index: number, metric: DashboardMetric): string {
    return metric.label;
  }

  trackBySegmentLabel(index: number, segment: StatusSegment): string {
    return segment.label;
  }

  trackByTicketId(index: number, ticket: Ticket): string {
    return ticket._id;
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    this.ticketService.list().subscribe({
      next: (tickets) => {
        this.summaryMetrics = this.computeMetrics(tickets);
        this.statusSegments = this.computeStatusSegments(tickets);
        this.recentTickets = [...tickets]
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
          .slice(0, 6);
        this.riskTickets = this.getAgingRiskTickets(tickets);
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'Unable to load dashboard data.';
        this.isLoading = false;
      },
    });
  }

  private computeMetrics(tickets: Ticket[]): DashboardMetric[] {
    const statusCounts = this.countByStatus(tickets);
    const priorityCounts = this.countByPriority(tickets);
    const unresolvedCount = statusCounts.open + statusCounts.in_progress;
    const recentlyClosedCount = tickets.filter((ticket) => {
      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return false;
      }

      const updatedAt = new Date(ticket.updatedAt).getTime();
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return updatedAt >= sevenDaysAgo;
    }).length;

    return [
      {
        label: 'Active Queue',
        value: String(unresolvedCount),
        hint: unresolvedCount > 0 ? 'Needs action' : 'All clear',
        icon: 'bolt',
        tone: unresolvedCount > 0 ? 'warn' : 'success',
      },
      {
        label: 'High Priority',
        value: String(priorityCounts.high),
        hint: priorityCounts.high > 0 ? 'Escalation focus' : 'No blockers',
        icon: 'priority_high',
        tone: priorityCounts.high > 0 ? 'warn' : 'neutral',
      },
      {
        label: 'Resolved in 7 Days',
        value: String(recentlyClosedCount),
        hint: 'Recent throughput',
        icon: 'task_alt',
        tone: 'success',
      },
      {
        label: 'Avg Resolution (hrs)',
        value: this.averageResolutionHours(tickets),
        hint: 'From creation to close',
        icon: 'schedule',
        tone: 'accent',
      },
    ];
  }

  private computeStatusSegments(tickets: Ticket[]): StatusSegment[] {
    const counts = this.countByStatus(tickets);
    const total = Math.max(tickets.length, 1);

    return [
      { label: 'Open', value: counts.open, percentage: Math.round((counts.open / total) * 100), css: 'open' },
      {
        label: 'In Progress',
        value: counts.in_progress,
        percentage: Math.round((counts.in_progress / total) * 100),
        css: 'progress',
      },
      { label: 'Resolved', value: counts.resolved, percentage: Math.round((counts.resolved / total) * 100), css: 'resolved' },
      { label: 'Closed', value: counts.closed, percentage: Math.round((counts.closed / total) * 100), css: 'closed' },
    ];
  }

  private getAgingRiskTickets(tickets: Ticket[]): Array<Ticket & { ageHours: number }> {
    const now = Date.now();

    return tickets
      .filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress')
      .map((ticket) => ({
        ...ticket,
        ageHours: (now - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60),
      }))
      .filter((ticket) => ticket.ageHours >= 48)
      .sort((left, right) => right.ageHours - left.ageHours)
      .slice(0, 5);
  }

  private countByStatus(tickets: Ticket[]): Record<TicketStatus, number> {
    return tickets.reduce<Record<TicketStatus, number>>(
      (counts, ticket) => {
        counts[ticket.status] += 1;
        return counts;
      },
      {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      },
    );
  }

  private countByPriority(tickets: Ticket[]): Record<TicketPriority, number> {
    return tickets.reduce<Record<TicketPriority, number>>(
      (counts, ticket) => {
        counts[ticket.priority] += 1;
        return counts;
      },
      {
        low: 0,
        medium: 0,
        high: 0,
      },
    );
  }

  private averageResolutionHours(tickets: Ticket[]): string {
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed');
    if (resolved.length === 0) {
      return '0.0';
    }

    const totalMs = resolved.reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt).getTime();
      const updated = new Date(ticket.updatedAt).getTime();
      return sum + Math.max(updated - created, 0);
    }, 0);

    const avgHours = totalMs / resolved.length / (1000 * 60 * 60);
    return avgHours.toFixed(1);
  }

  private getRoleLabel(): string {
    const role = this.authService.currentUser?.role;
    if (role === 'admin') return 'Admin Command Center';
    if (role === 'agent') return 'Agent Execution Board';
    return 'Customer Support Snapshot';
  }
}
