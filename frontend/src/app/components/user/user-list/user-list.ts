import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, NgClass, NgFor, TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../../../core/services/notification.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser, UserRole } from '../../../models/user.model';

@Component({
  selector: 'app-user-list',
  imports: [
    ReactiveFormsModule,
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
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserListComponent implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage = '';
  users: AppUser[] = [];
  activeMutations = new Set<string>();

  totalCount = 0;
  activeCount = 0;
  agentCount = 0;
  adminCount = 0;

  readonly roles: UserRole[] = ['user', 'agent', 'admin'];
  readonly displayedColumns = ['name', 'email', 'role', 'status', 'createdAt', 'actions'];
  readonly roleDrafts = new Map<string, UserRole>();

  readonly filtersForm = this.formBuilder.nonNullable.group({
    role: '',
    isActive: 'all',
    search: '',
  });

  ngOnInit(): void {
    this.filtersForm.valueChanges.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.loadUsers());
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get currentUserId(): string | null {
    return this.authService.currentUser?._id ?? this.authService.currentUser?.id ?? null;
  }

  isMutating(user: AppUser): boolean {
    const userId = user._id ?? user.id;
    return userId ? this.activeMutations.has(userId) : false;
  }

  canMutateUser(user: AppUser): boolean {
    const userId = user._id ?? user.id;
    return !!userId && userId !== this.currentUserId;
  }

  draftRoleFor(user: AppUser): UserRole {
    const userId = user._id ?? user.id;
    if (!userId) {
      return user.role;
    }

    return this.roleDrafts.get(userId) ?? user.role;
  }

  onRoleDraftChange(user: AppUser, role: UserRole): void {
    const userId = user._id ?? user.id;
    if (!userId) {
      return;
    }

    this.roleDrafts.set(userId, role);
  }

  applyRoleUpdate(user: AppUser): void {
    const userId = user._id ?? user.id;
    if (!userId || this.isMutating(user)) {
      return;
    }

    const nextRole = this.draftRoleFor(user);
    if (nextRole === user.role) {
      this.notificationService.info('No role changes to save.');
      return;
    }

    this.activeMutations.add(userId);

    this.userService.updateById(userId, { role: nextRole }).subscribe({
      next: (updated) => {
        this.replaceUser(updated);
        this.notificationService.success(`Updated role for ${updated.name}.`);
        this.activeMutations.delete(userId);
      },
      error: (error) => {
        this.notificationService.error(error?.error?.message ?? 'Unable to update role.');
        this.activeMutations.delete(userId);
      },
    });
  }

  toggleActive(user: AppUser): void {
    const userId = user._id ?? user.id;
    if (!userId || this.isMutating(user) || !this.canMutateUser(user)) {
      return;
    }

    this.activeMutations.add(userId);

    const currentlyActive = user.isActive !== false;
    const nextActive = !currentlyActive;

    if (!nextActive) {
      this.userService.disableById(userId).subscribe({
        next: () => {
          this.replaceUser({ ...user, isActive: false });
          this.notificationService.warn(`${user.name} has been deactivated.`);
          this.activeMutations.delete(userId);
        },
        error: (error) => {
          this.notificationService.error(error?.error?.message ?? 'Unable to deactivate user.');
          this.activeMutations.delete(userId);
        },
      });
      return;
    }

    this.userService.updateById(userId, { isActive: true }).subscribe({
      next: (updated) => {
        this.replaceUser(updated);
        this.notificationService.success(`${updated.name} has been reactivated.`);
        this.activeMutations.delete(userId);
      },
      error: (error) => {
        this.notificationService.error(error?.error?.message ?? 'Unable to reactivate user.');
        this.activeMutations.delete(userId);
      },
    });
  }

  resetFilters(): void {
    this.filtersForm.reset({ role: '', isActive: 'all', search: '' }, { emitEvent: false });
    this.loadUsers();
  }

  private loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const { role, isActive, search } = this.filtersForm.getRawValue();

    this.userService
      .list({
        role: (role || undefined) as UserRole | undefined,
        isActive: isActive === 'all' ? undefined : isActive === 'active',
        search: search || undefined,
      })
      .subscribe({
        next: (users) => {
          this.users = users;
          this.users.forEach((user) => {
            const userId = user._id ?? user.id;
            if (userId) {
              this.roleDrafts.set(userId, user.role);
            }
          });
          this.computeStats(users);
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = error?.error?.message ?? 'Unable to load users.';
          this.isLoading = false;
        },
      });
  }

  private replaceUser(updated: AppUser): void {
    const updatedId = updated._id ?? updated.id;
    this.users = this.users.map((user) => {
      const userId = user._id ?? user.id;
      return userId === updatedId ? updated : user;
    });

    if (updatedId) {
      this.roleDrafts.set(updatedId, updated.role);
    }

    this.computeStats(this.users);
  }

  private computeStats(users: AppUser[]): void {
    this.totalCount = users.length;
    this.activeCount = users.filter((user) => user.isActive !== false).length;
    this.agentCount = users.filter((user) => user.role === 'agent').length;
    this.adminCount = users.filter((user) => user.role === 'admin').length;
  }
}
