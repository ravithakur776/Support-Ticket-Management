import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, NgFor, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Ticket, TicketPriority, TicketStatus, TicketUpdatePayload } from '../../../models/ticket.model';
import { TicketComment } from '../../../models/comment.model';
import { AppUser, UserRole } from '../../../models/user.model';

@Component({
  selector: 'app-ticket-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    NgFor,
    NgClass,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.scss',
})
export class TicketDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroy$ = new Subject<void>();
  private readonly optimisticCommentIds = new Set<string>();

  ticketId = '';
  ticket: Ticket | null = null;
  comments: TicketComment[] = [];
  assignableUsers: AppUser[] = [];

  isLoading = true;
  isSaving = false;
  isPostingComment = false;

  errorMessage = '';
  updateMessage = '';
  commentMessage = '';

  readonly allStatuses: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  readonly allPriorities: TicketPriority[] = ['low', 'medium', 'high'];

  readonly updateForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    priority: ['medium' as TicketPriority, Validators.required],
    status: ['open' as TicketStatus, Validators.required],
    assignedTo: [''],
  });

  readonly commentForm = this.formBuilder.nonNullable.group({
    content: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(3000)]],
  });

  ngOnInit(): void {
    this.realtimeService.connect();

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            this.errorMessage = 'Ticket identifier is missing.';
            this.isLoading = false;
            return of(null);
          }

          this.ticketId = id;
          this.isLoading = true;
          this.errorMessage = '';
          this.updateMessage = '';
          this.commentMessage = '';

          const shouldLoadAssignableUsers = this.currentRole === 'admin';

          return forkJoin({
            ticket: this.ticketService.getById(id),
            comments: this.ticketService.listComments(id),
            users: shouldLoadAssignableUsers
              ? this.userService.list({ role: 'agent', isActive: true }).pipe(catchError(() => of([])))
              : of([]),
          });
        }),
      )
      .subscribe({
        next: (result) => {
          if (!result) {
            return;
          }

          this.ticket = result.ticket;
          this.comments = result.comments;
          this.assignableUsers = result.users;
          this.patchUpdateForm(this.ticket);
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = error?.error?.message ?? 'Unable to load ticket details.';
          this.isLoading = false;
        },
      });

    this.realtimeService.ticketUpdated$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event.ticket?._id === this.ticketId) {
        this.ticket = event.ticket;
        this.patchUpdateForm(event.ticket);
      }
    });

    this.realtimeService.commentCreated$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event.ticketId === this.ticketId) {
        this.reconcileOptimisticComment(event.comment);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get currentUser(): AppUser | null {
    return this.authService.currentUser;
  }

  get currentRole(): UserRole | null {
    return this.currentUser?.role ?? null;
  }

  get isAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  get isAgent(): boolean {
    return this.currentRole === 'agent';
  }

  get isEndUser(): boolean {
    return this.currentRole === 'user';
  }

  get allowedStatusesForRole(): TicketStatus[] {
    if (this.isEndUser) {
      return ['closed'];
    }

    return this.allStatuses;
  }

  get canEditCoreFields(): boolean {
    return this.isAdmin;
  }

  get canManageWorkflowFields(): boolean {
    return this.isAdmin || this.isAgent;
  }

  get canCloseTicket(): boolean {
    if (!this.isEndUser || !this.ticket) {
      return false;
    }

    return this.ticket.status !== 'closed';
  }

  get createdByName(): string {
    return this.resolveUserName(this.ticket?.createdBy);
  }

  get assignedToName(): string {
    return this.resolveUserName(this.ticket?.assignedTo);
  }

  get ticketAgeHours(): number {
    if (!this.ticket) {
      return 0;
    }

    return Math.max((Date.now() - new Date(this.ticket.createdAt).getTime()) / (1000 * 60 * 60), 0);
  }

  get quickTransitionStatuses(): TicketStatus[] {
    if (!this.ticket || this.isEndUser) {
      return [];
    }

    const workflowMap: Record<TicketStatus, TicketStatus[]> = {
      open: ['in_progress', 'resolved'],
      in_progress: ['resolved', 'closed'],
      resolved: ['closed', 'in_progress'],
      closed: this.isAdmin ? ['open'] : [],
    };

    return workflowMap[this.ticket.status] ?? [];
  }

  saveTicketUpdate(): void {
    if (!this.ticket || this.isSaving) {
      return;
    }

    if (!this.isEndUser && this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      return;
    }

    const payload = this.buildUpdatePayload();

    if (!payload) {
      this.updateMessage = 'No changes detected.';
      this.notificationService.warn('No ticket changes to save.');
      return;
    }

    this.runOptimisticTicketUpdate(payload, 'Ticket updated successfully.', 'Failed to update ticket.');
  }

  closeTicketAsUser(): void {
    if (!this.canCloseTicket || this.isSaving) {
      return;
    }

    this.runOptimisticTicketUpdate({ status: 'closed' }, 'Ticket closed successfully.', 'Unable to close ticket.');
  }

  postComment(): void {
    if (this.commentForm.invalid || this.isPostingComment) {
      this.commentForm.markAllAsTouched();
      return;
    }

    this.isPostingComment = true;
    this.commentMessage = '';

    const content = this.commentForm.getRawValue().content.trim();
    if (!content) {
      this.commentMessage = 'Comment cannot be empty.';
      this.notificationService.warn(this.commentMessage);
      this.isPostingComment = false;
      return;
    }

    const tempCommentId = `temp-${Date.now()}`;
    const optimisticComment: TicketComment = {
      _id: tempCommentId,
      ticketId: this.ticketId,
      authorId: this.currentUser ?? 'You',
      content,
      createdAt: new Date().toISOString(),
    };

    this.optimisticCommentIds.add(tempCommentId);
    this.upsertComment(optimisticComment);
    this.commentForm.reset({ content: '' });

    this.ticketService.createComment(this.ticketId, content).subscribe({
      next: (comment) => {
        this.optimisticCommentIds.delete(tempCommentId);
        this.removeCommentById(tempCommentId);
        this.upsertComment(comment);
        this.commentMessage = 'Comment posted.';
        this.notificationService.success('Comment posted successfully.');
        this.isPostingComment = false;
      },
      error: (error) => {
        this.optimisticCommentIds.delete(tempCommentId);
        this.removeCommentById(tempCommentId);
        this.commentForm.patchValue({ content });
        this.commentMessage = error?.error?.message ?? 'Unable to post comment.';
        this.notificationService.error(this.commentMessage);
        this.isPostingComment = false;
      },
    });
  }

  commentAuthorName(comment: TicketComment): string {
    return this.resolveUserName(comment.authorId);
  }

  quickSetStatus(status: TicketStatus): void {
    if (!this.ticket || this.isSaving || this.ticket.status === status) {
      return;
    }

    this.runOptimisticTicketUpdate(
      { status },
      `Status updated to ${status.replace('_', ' ')}`,
      'Unable to update ticket status.',
    );
  }

  copyTicketId(): void {
    if (!this.ticket) {
      return;
    }

    navigator.clipboard
      .writeText(this.ticket._id)
      .then(() => this.notificationService.success('Ticket ID copied.'))
      .catch(() => this.notificationService.warn('Unable to copy ticket ID.'));
  }

  statusActionLabel(status: TicketStatus): string {
    if (status === 'in_progress') return 'Start Work';
    if (status === 'resolved') return 'Mark Resolved';
    if (status === 'closed') return 'Close';
    return 'Reopen';
  }

  submitCommentFromKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.postComment();
    }
  }

  private patchUpdateForm(ticket: Ticket): void {
    this.updateForm.patchValue({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: this.extractUserId(ticket.assignedTo) ?? '',
    });
  }

  private runOptimisticTicketUpdate(payload: TicketUpdatePayload, successMessage: string, fallbackError: string): void {
    if (!this.ticket) {
      return;
    }

    const previousTicket = this.cloneTicket(this.ticket);
    const optimisticTicket = this.buildOptimisticTicket(previousTicket, payload);

    this.ticket = optimisticTicket;
    this.patchUpdateForm(optimisticTicket);
    this.isSaving = true;
    this.updateMessage = '';

    this.ticketService.updateById(this.ticketId, payload).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.patchUpdateForm(updatedTicket);
        this.updateMessage = successMessage;
        this.notificationService.success(successMessage);
        this.isSaving = false;
      },
      error: (error) => {
        this.ticket = previousTicket;
        this.patchUpdateForm(previousTicket);
        this.updateMessage = error?.error?.message ?? fallbackError;
        this.notificationService.error(this.updateMessage);
        this.isSaving = false;
      },
    });
  }

  private buildUpdatePayload(): TicketUpdatePayload | null {
    if (!this.ticket) {
      return null;
    }

    if (this.isEndUser) {
      return this.canCloseTicket ? { status: 'closed' } : null;
    }

    const formValue = this.updateForm.getRawValue();
    const payload: TicketUpdatePayload = {};

    if (this.isAdmin) {
      if (formValue.title !== this.ticket.title) payload.title = formValue.title;
      if (formValue.description !== this.ticket.description) payload.description = formValue.description;
    }

    if ((this.isAdmin || this.isAgent) && formValue.priority !== this.ticket.priority) {
      payload.priority = formValue.priority;
    }

    if ((this.isAdmin || this.isAgent) && formValue.status !== this.ticket.status) {
      payload.status = formValue.status;
    }

    if (this.isAdmin) {
      const currentAssigned = this.extractUserId(this.ticket.assignedTo) ?? '';
      if (formValue.assignedTo !== currentAssigned) {
        payload.assignedTo = formValue.assignedTo.trim() ? formValue.assignedTo.trim() : null;
      }
    }

    return Object.keys(payload).length > 0 ? payload : null;
  }

  private buildOptimisticTicket(ticket: Ticket, payload: TicketUpdatePayload): Ticket {
    const optimisticTicket = this.cloneTicket(ticket);

    if (payload.title !== undefined) optimisticTicket.title = payload.title;
    if (payload.description !== undefined) optimisticTicket.description = payload.description;
    if (payload.priority !== undefined) optimisticTicket.priority = payload.priority;

    if (payload.assignedTo !== undefined) {
      optimisticTicket.assignedTo = this.resolveAssignedValueForOptimistic(payload.assignedTo);
    }

    if (payload.status !== undefined) {
      const previousStatus = optimisticTicket.status;
      optimisticTicket.status = payload.status;

      if (previousStatus !== payload.status) {
        const historyItem = {
          fromStatus: previousStatus,
          toStatus: payload.status,
          changedBy: this.currentUser ?? 'current-user',
          note: `Status changed by ${this.currentRole ?? 'user'}`,
          changedAt: new Date().toISOString(),
        };

        optimisticTicket.statusHistory = [...(optimisticTicket.statusHistory ?? []), historyItem];
      }
    }

    optimisticTicket.updatedAt = new Date().toISOString();
    return optimisticTicket;
  }

  private resolveAssignedValueForOptimistic(assignedTo: string | null): string | AppUser | null {
    if (!assignedTo) {
      return null;
    }

    const matched = this.assignableUsers.find((user) => (user._id ?? user.id) === assignedTo);
    return matched ?? assignedTo;
  }

  private upsertComment(comment: TicketComment): void {
    const existingIndex = this.comments.findIndex((item) => item._id === comment._id);

    if (existingIndex >= 0) {
      this.comments[existingIndex] = comment;
    } else {
      this.comments = [...this.comments, comment].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    }
  }

  private removeCommentById(commentId: string): void {
    this.comments = this.comments.filter((item) => item._id !== commentId);
  }

  private reconcileOptimisticComment(incomingComment: TicketComment): void {
    const existingComment = this.comments.find((item) => item._id === incomingComment._id);
    if (existingComment) {
      this.upsertComment(incomingComment);
      return;
    }

    const optimisticMatch = this.comments.find((item) => {
      if (!this.optimisticCommentIds.has(item._id)) {
        return false;
      }

      const sameContent = item.content === incomingComment.content;
      const sameAuthor = this.resolveAuthorId(item.authorId) === this.resolveAuthorId(incomingComment.authorId);
      return sameContent && sameAuthor;
    });

    if (optimisticMatch) {
      this.optimisticCommentIds.delete(optimisticMatch._id);
      this.removeCommentById(optimisticMatch._id);
    }

    this.upsertComment(incomingComment);
  }

  private resolveUserName(value: string | AppUser | null | undefined): string {
    if (!value) {
      return 'Unassigned';
    }

    if (typeof value === 'string') {
      return value.slice(0, 8);
    }

    return value.name;
  }

  private extractUserId(value: string | AppUser | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return value._id ?? value.id ?? null;
  }

  private resolveAuthorId(value: string | AppUser): string {
    if (typeof value === 'string') {
      return value;
    }

    return value._id ?? value.id ?? value.email;
  }

  private cloneTicket(ticket: Ticket): Ticket {
    return JSON.parse(JSON.stringify(ticket)) as Ticket;
  }
}
