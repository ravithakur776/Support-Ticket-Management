import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, MatButtonModule, MatCardModule],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.scss',
})
export class ForbiddenComponent {}
