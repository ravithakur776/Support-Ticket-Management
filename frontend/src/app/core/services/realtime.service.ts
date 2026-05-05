import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';
import { CommentSocketEvent, SocketReadyEvent, TicketSocketEvent } from '../../models/socket-events.model';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket: Socket | null = null;

  private readonly readySubject = new Subject<SocketReadyEvent>();
  private readonly ticketUpdatedSubject = new Subject<TicketSocketEvent>();
  private readonly ticketCreatedSubject = new Subject<TicketSocketEvent>();
  private readonly commentCreatedSubject = new Subject<CommentSocketEvent>();

  readonly ready$ = this.readySubject.asObservable();
  readonly ticketUpdated$ = this.ticketUpdatedSubject.asObservable();
  readonly ticketCreated$ = this.ticketCreatedSubject.asObservable();
  readonly commentCreated$ = this.commentCreatedSubject.asObservable();

  constructor(private readonly tokenStorage: TokenStorageService) {}

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.tokenStorage.getToken();
    if (!token) {
      return;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    const socketUrl = environment.socketUrl || undefined;
    this.socket = io(socketUrl, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('socket:ready', (payload: SocketReadyEvent) => this.readySubject.next(payload));
    this.socket.on('ticket:updated', (payload: TicketSocketEvent) => this.ticketUpdatedSubject.next(payload));
    this.socket.on('ticket:created', (payload: TicketSocketEvent) => this.ticketCreatedSubject.next(payload));
    this.socket.on('comment:created', (payload: CommentSocketEvent) => this.commentCreatedSubject.next(payload));
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
}
