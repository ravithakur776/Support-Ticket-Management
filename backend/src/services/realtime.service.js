const { emitToRole, emitToUser } = require('./socket.service');
const { USER_ROLES } = require('../utils/constants');

const toPlain = (doc) => (doc?.toObject ? doc.toObject() : doc);

const emitTicketCreated = (ticketDoc) => {
  const ticket = toPlain(ticketDoc);
  if (!ticket) return;

  const payload = {
    ticket,
    event: 'ticket_created',
    at: new Date().toISOString(),
  };

  emitToRole(USER_ROLES.ADMIN, 'ticket:created', payload);

  if (ticket.assignedTo?._id || ticket.assignedTo) {
    const assigneeId = ticket.assignedTo._id || ticket.assignedTo;
    emitToUser(assigneeId, 'ticket:assigned', payload);
  }

  if (ticket.createdBy?._id || ticket.createdBy) {
    const creatorId = ticket.createdBy._id || ticket.createdBy;
    emitToUser(creatorId, 'ticket:created', payload);
  }
};

const emitTicketUpdated = (ticketDoc) => {
  const ticket = toPlain(ticketDoc);
  if (!ticket) return;

  const payload = {
    ticket,
    event: 'ticket_updated',
    at: new Date().toISOString(),
  };

  emitToRole(USER_ROLES.ADMIN, 'ticket:updated', payload);

  if (ticket.assignedTo?._id || ticket.assignedTo) {
    const assigneeId = ticket.assignedTo._id || ticket.assignedTo;
    emitToUser(assigneeId, 'ticket:updated', payload);
  }

  if (ticket.createdBy?._id || ticket.createdBy) {
    const creatorId = ticket.createdBy._id || ticket.createdBy;
    emitToUser(creatorId, 'ticket:updated', payload);
  }
};

const emitCommentCreated = (commentDoc, ticketDoc) => {
  const comment = toPlain(commentDoc);
  const ticket = toPlain(ticketDoc);
  if (!comment || !ticket) return;

  const payload = {
    comment,
    ticketId: ticket._id,
    event: 'comment_created',
    at: new Date().toISOString(),
  };

  emitToRole(USER_ROLES.ADMIN, 'comment:created', payload);

  if (ticket.assignedTo?._id || ticket.assignedTo) {
    const assigneeId = ticket.assignedTo._id || ticket.assignedTo;
    emitToUser(assigneeId, 'comment:created', payload);
  }

  if (ticket.createdBy?._id || ticket.createdBy) {
    const creatorId = ticket.createdBy._id || ticket.createdBy;
    emitToUser(creatorId, 'comment:created', payload);
  }
};

module.exports = {
  emitTicketCreated,
  emitTicketUpdated,
  emitCommentCreated,
};
