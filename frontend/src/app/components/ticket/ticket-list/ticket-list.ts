import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, NgClass, NgFor, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, merge, Subject } from 'rxjs';
import { auditTime, takeUntil } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TicketService } from '../../../core/services/ticket.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AppUser } from '../../../models/user.model';
import { Ticket, TicketCreatePayload, TicketFilters, TicketPriority, TicketStatus } from '../../../models/ticket.model';

type TicketSort = 'updated_desc' | 'updated_asc' | 'priority_desc' | 'priority_asc' | 'status';

@Component({
  selector: 'app-ticket-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgFor,
    NgClass,
    DatePipe,
    TitleCasePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ticket-list.html',
  styleUrl: './ticket-list.scss',
})
export class TicketListComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly filterStorageKey = 'sts.ticket.filters.v2';

  isLoading = false;
  isBackgroundRefreshing = false;
  isCreatePanelOpen = false;
  isCreatingTicket = false;
  errorMessage = '';
  createMessage = '';
  private isRequestInFlight = false;
  private shouldReloadAfterInFlight = false;

  tickets: Ticket[] = [];

  totalCount = 0;
  unresolvedCount = 0;
  highPriorityCount = 0;
  unassignedCount = 0;

  readonly statuses: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  readonly priorities: TicketPriority[] = ['low', 'medium', 'high'];
  readonly sortOptions: Array<{ value: TicketSort; label: string }> = [
    { value: 'updated_desc', label: 'Newest Activity' },
    { value: 'updated_asc', label: 'Oldest Activity' },
    { value: 'priority_desc', label: 'Priority High to Low' },
    { value: 'priority_asc', label: 'Priority Low to High' },
    { value: 'status', label: 'Workflow Status' },
  ];

  readonly displayedColumns = ['title', 'status', 'priority', 'createdBy', 'assignedTo', 'updatedAt', 'actions'];

  readonly filtersForm = this.formBuilder.nonNullable.group({
    status: '',
    priority: '',
    search: '',
    sortBy: 'updated_desc' as TicketSort,
    unassignedOnly: false,
  });

  readonly createForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    priority: ['medium' as TicketPriority, Validators.required],
  });

  ngOnInit(): void {
    this.restorePersistedFilters();

    this.filtersForm.valueChanges.pipe(debounceTime(240), takeUntil(this.destroy$)).subscribe(() => {
      this.persistFilters();
      this.loadTickets();
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params.get('create') === '1') {
        this.isCreatePanelOpen = true;
      }
    });

    this.loadTickets();

    merge(
      this.realtimeService.ticketUpdated$,
      this.realtimeService.ticketCreated$,
      this.realtimeService.commentCreated$,
    )
      .pipe(auditTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.loadTickets(true));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get roleTicketLabel(): string {
    const role = this.authService.currentUser?.role;
    if (role === 'admin') return 'All Tickets';
    if (role === 'agent') return 'Assigned Tickets';
    return 'My Tickets';
  }

  ownerName(value: string | AppUser | null | undefined): string {
    if (!value) {
      return 'Unassigned';
    }

    if (typeof value === 'string') {
      return value.slice(0, 8);
    }

    return value.name;
  }

  trackByValue(index: number, value: string): string {
    return value;
  }

  trackBySortOption(index: number, option: { value: TicketSort; label: string }): string {
    return option.value;
  }

  toggleCreatePanel(): void {
    this.isCreatePanelOpen = !this.isCreatePanelOpen;
    this.createMessage = '';

    if (this.isCreatePanelOpen) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: '1' },
        queryParamsHandling: 'merge',
      });
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  createTicket(): void {
    if (this.createForm.invalid || this.isCreatingTicket) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isCreatingTicket = true;
    this.createMessage = '';

    const payload: TicketCreatePayload = this.createForm.getRawValue();

    this.ticketService.create(payload).subscribe({
      next: (ticket) => {
        this.notificationService.success('Ticket created successfully.');
        this.createMessage = 'Ticket created successfully.';
        this.createForm.reset({ title: '', description: '', priority: 'medium' });
        this.isCreatingTicket = false;
        this.isCreatePanelOpen = false;
        this.router.navigate(['/tickets', ticket._id]);
      },
      error: (error) => {
        this.createMessage = error?.error?.message ?? 'Unable to create ticket.';
        this.notificationService.error(this.createMessage);
        this.isCreatingTicket = false;
      },
    });
  }

  resetFilters(): void {
    this.filtersForm.reset(
      {
        status: '',
        priority: '',
        search: '',
        sortBy: 'updated_desc',
        unassignedOnly: false,
      },
      { emitEvent: false },
    );

    this.persistFilters();
    this.loadTickets();
  }

  private loadTickets(background = false): void {
    if (this.isRequestInFlight) {
      this.shouldReloadAfterInFlight = true;
      return;
    }

    this.isRequestInFlight = true;

    if (background) {
      this.isBackgroundRefreshing = true;
    } else {
      this.isLoading = true;
    }

    this.errorMessage = '';

    const raw = this.filtersForm.getRawValue();
    const filters: TicketFilters = {
      status: (raw.status || '') as TicketStatus | '',
      priority: (raw.priority || '') as TicketPriority | '',
      search: raw.search || '',
    };

    this.ticketService.list(filters).subscribe({
      next: (tickets) => {
        this.tickets = this.applyClientTransforms(tickets);
        this.computeSummaryStats(this.tickets);
        this.completeLoadCycle();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'Unable to load tickets.';
        this.completeLoadCycle();
      },
    });
  }

  private completeLoadCycle(): void {
    this.isLoading = false;
    this.isBackgroundRefreshing = false;
    this.isRequestInFlight = false;

    if (this.shouldReloadAfterInFlight) {
      this.shouldReloadAfterInFlight = false;
      this.loadTickets(true);
    }
  }

  private applyClientTransforms(source: Ticket[]): Ticket[] {
    const { sortBy, unassignedOnly } = this.filtersForm.getRawValue();
    let working = [...source];

    if (unassignedOnly) {
      working = working.filter((ticket) => !ticket.assignedTo);
    }

    if (sortBy === 'updated_desc') {
      return working.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    }

    if (sortBy === 'updated_asc') {
      return working.sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime());
    }

    if (sortBy === 'priority_desc') {
      const rank: Record<TicketPriority, number> = { high: 3, medium: 2, low: 1 };
      return working.sort((left, right) => rank[right.priority] - rank[left.priority]);
    }

    if (sortBy === 'priority_asc') {
      const rank: Record<TicketPriority, number> = { low: 1, medium: 2, high: 3 };
      return working.sort((left, right) => rank[left.priority] - rank[right.priority]);
    }

    const statusOrder: Record<TicketStatus, number> = { open: 1, in_progress: 2, resolved: 3, closed: 4 };
    return working.sort((left, right) => statusOrder[left.status] - statusOrder[right.status]);
  }

  private computeSummaryStats(tickets: Ticket[]): void {
    this.totalCount = tickets.length;
    this.unresolvedCount = tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length;
    this.highPriorityCount = tickets.filter((ticket) => ticket.priority === 'high').length;
    this.unassignedCount = tickets.filter((ticket) => !ticket.assignedTo).length;
  }

  private persistFilters(): void {
    sessionStorage.setItem(this.filterStorageKey, JSON.stringify(this.filtersForm.getRawValue()));
  }

  private restorePersistedFilters(): void {
    const raw = sessionStorage.getItem(this.filterStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        status?: string;
        priority?: string;
        search?: string;
        sortBy?: TicketSort;
        unassignedOnly?: boolean;
      };

      this.filtersForm.patchValue(
        {
          status: parsed.status ?? '',
          priority: parsed.priority ?? '',
          search: parsed.search ?? '',
          sortBy: parsed.sortBy ?? 'updated_desc',
          unassignedOnly: parsed.unassignedOnly ?? false,
        },
        { emitEvent: false },
      );
    } catch {
      sessionStorage.removeItem(this.filterStorageKey);
    }
  }
}
