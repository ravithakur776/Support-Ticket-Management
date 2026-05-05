const { USER_ROLES } = require('../utils/constants');

const isAdmin = (user) => user?.role === USER_ROLES.ADMIN;
const isAgent = (user) => user?.role === USER_ROLES.AGENT;
const isEndUser = (user) => user?.role === USER_ROLES.USER;

const sameId = (left, right) => String(left) === String(right);

const canAccessTicket = (user, ticket) => {
  if (!user || !ticket) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (ticket.createdBy && sameId(ticket.createdBy, user._id)) {
    return true;
  }

  if (ticket.assignedTo && sameId(ticket.assignedTo, user._id)) {
    return true;
  }

  return false;
};

const canManageTicket = (user, ticket) => {
  if (!user || !ticket) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isAgent(user) && ticket.assignedTo && sameId(ticket.assignedTo, user._id)) {
    return true;
  }

  if (isEndUser(user) && ticket.createdBy && sameId(ticket.createdBy, user._id)) {
    return true;
  }

  return false;
};

const buildTicketScopeQuery = (user) => {
  if (isAdmin(user)) {
    return {};
  }

  if (isAgent(user)) {
    return { assignedTo: user._id };
  }

  return { createdBy: user._id };
};

module.exports = {
  isAdmin,
  isAgent,
  isEndUser,
  canAccessTicket,
  canManageTicket,
  buildTicketScopeQuery,
};
