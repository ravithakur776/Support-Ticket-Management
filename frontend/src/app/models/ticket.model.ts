import { AppUser } from './user.model';

export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketStatusHistoryItem {
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedBy: string | AppUser;
  note?: string;
  changedAt: string;
}

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string | AppUser;
  assignedTo: string | AppUser | null;
  statusHistory?: TicketStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilters {
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  search?: string;
}

export interface TicketCreatePayload {
  title: string;
  description: string;
  priority: TicketPriority;
}

export interface TicketListResponse {
  data: {
    count: number;
    tickets: Ticket[];
  };
}

export interface TicketDetailResponse {
  data: {
    ticket: Ticket;
  };
}

export interface TicketCreateResponse {
  message: string;
  data: {
    ticket: Ticket;
  };
}

export interface TicketUpdatePayload {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedTo?: string | null;
}

export interface TicketUpdateResponse {
  message: string;
  data: {
    ticket: Ticket;
  };
}
