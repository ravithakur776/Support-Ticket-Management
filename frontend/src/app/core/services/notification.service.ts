import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  info(message: string): void {
    this.open(message, ['snack-info']);
  }

  success(message: string): void {
    this.open(message, ['snack-success']);
  }

  warn(message: string): void {
    this.open(message, ['snack-warn']);
  }

  error(message: string): void {
    this.open(message, ['snack-error'], 4500);
  }

  private open(message: string, panelClass: string[], duration = 2800): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass,
    };

    this.snackBar.open(message, 'Dismiss', config);
  }
}
