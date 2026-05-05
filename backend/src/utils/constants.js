const USER_ROLES = {
  USER: 'user',
  AGENT: 'agent',
  ADMIN: 'admin',
};

const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

module.exports = {
  USER_ROLES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
};
