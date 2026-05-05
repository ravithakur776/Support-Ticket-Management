import { AppUser } from './user.model';

export interface TicketComment {
  _id: string;
  ticketId: string;
  authorId: string | AppUser;
  content: string;
  createdAt: string;
}

export interface CommentListResponse {
  data: {
    count: number;
    comments: TicketComment[];
  };
}

export interface CommentCreateResponse {
  message: string;
  data: {
    comment: TicketComment;
  };
}
