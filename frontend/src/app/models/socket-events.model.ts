import { Ticket } from './ticket.model';
import { TicketComment } from './comment.model';

export interface SocketReadyEvent {
  message: string;
  userId: string;
  role: string;
  connectedAt: string;
}

export interface TicketSocketEvent {
  ticket: Ticket;
  event: string;
  at: string;
}

export interface CommentSocketEvent {
  comment: TicketComment;
  ticketId: string;
  event: string;
  at: string;
}
