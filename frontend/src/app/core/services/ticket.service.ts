import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Ticket,
  TicketCreatePayload,
  TicketCreateResponse,
  TicketDetailResponse,
  TicketFilters,
  TicketListResponse,
  TicketUpdatePayload,
  TicketUpdateResponse,
} from '../../models/ticket.model';
import { CommentCreateResponse, CommentListResponse, TicketComment } from '../../models/comment.model';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  list(filters: TicketFilters = {}): Observable<Ticket[]> {
    let params = new HttpParams();

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    if (filters.priority) {
      params = params.set('priority', filters.priority);
    }

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    return this.http
      .get<TicketListResponse>(`${this.apiBaseUrl}/tickets`, {
        params,
        withCredentials: true,
      })
      .pipe(map((response) => response.data.tickets));
  }

  create(payload: TicketCreatePayload): Observable<Ticket> {
    return this.http
      .post<TicketCreateResponse>(`${this.apiBaseUrl}/tickets`, payload, { withCredentials: true })
      .pipe(map((response) => response.data.ticket));
  }

  getById(ticketId: string): Observable<Ticket> {
    return this.http
      .get<TicketDetailResponse>(`${this.apiBaseUrl}/tickets/${ticketId}`, { withCredentials: true })
      .pipe(map((response) => response.data.ticket));
  }

  updateById(ticketId: string, payload: TicketUpdatePayload): Observable<Ticket> {
    return this.http
      .put<TicketUpdateResponse>(`${this.apiBaseUrl}/tickets/${ticketId}`, payload, { withCredentials: true })
      .pipe(map((response) => response.data.ticket));
  }

  listComments(ticketId: string): Observable<TicketComment[]> {
    return this.http
      .get<CommentListResponse>(`${this.apiBaseUrl}/tickets/${ticketId}/comments`, { withCredentials: true })
      .pipe(map((response) => response.data.comments));
  }

  createComment(ticketId: string, content: string): Observable<TicketComment> {
    return this.http
      .post<CommentCreateResponse>(`${this.apiBaseUrl}/tickets/${ticketId}/comments`, { content }, { withCredentials: true })
      .pipe(map((response) => response.data.comment));
  }
}
