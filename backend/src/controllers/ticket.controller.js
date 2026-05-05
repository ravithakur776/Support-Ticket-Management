const mongoose = require('mongoose');
const { body, param, query } = require('express-validator');
const Ticket = require('../models/ticket.model');
const User = require('../models/user.model');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/apiError');
const { TICKET_PRIORITIES, TICKET_STATUSES, USER_ROLES } = require('../utils/constants');
const { getPagination } = require('../utils/pagination');
const { emitTicketCreated, emitTicketUpdated } = require('../services/realtime.service');
const {
  isAdmin,
  isAgent,
  isEndUser,
  canAccessTicket,
  canManageTicket,
  buildTicketScopeQuery,
} = require('../services/ticketAccess.service');

const isMongoIdOrNull = (value) => value === null || mongoose.Types.ObjectId.isValid(value);

const parseObjectId = (value) => (value ? new mongoose.Types.ObjectId(value) : null);

const ticketValidators = {
  list: [
    query('status').optional().isIn(TICKET_STATUSES).withMessage(`status must be one of: ${TICKET_STATUSES.join(', ')}`),
    query('priority')
      .optional()
      .isIn(TICKET_PRIORITIES)
      .withMessage(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`),
    query('search').optional().trim().isLength({ min: 1, max: 120 }).withMessage('search must be 1-120 characters'),
    query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  ],
  create: [
    body('title').trim().isLength({ min: 5, max: 150 }).withMessage('title must be between 5 and 150 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('description must be between 10 and 5000 characters'),
    body('priority')
      .optional()
      .isIn(TICKET_PRIORITIES)
      .withMessage(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`),
    body('assignedTo')
      .optional({ nullable: true })
      .custom(isMongoIdOrNull)
      .withMessage('assignedTo must be a valid user id or null'),
  ],
  byId: [param('id').isMongoId().withMessage('Valid ticket id is required')],
  update: [
    param('id').isMongoId().withMessage('Valid ticket id is required'),
    body('title').optional().trim().isLength({ min: 5, max: 150 }).withMessage('title must be between 5 and 150 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('description must be between 10 and 5000 characters'),
    body('priority')
      .optional()
      .isIn(TICKET_PRIORITIES)
      .withMessage(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`),
    body('status').optional().isIn(TICKET_STATUSES).withMessage(`status must be one of: ${TICKET_STATUSES.join(', ')}`),
    body('assignedTo')
      .optional({ nullable: true })
      .custom(isMongoIdOrNull)
      .withMessage('assignedTo must be a valid user id or null'),
  ],
};

const getListQueryFilters = (req) => {
  const scopedQuery = buildTicketScopeQuery(req.user);

  if (req.query.status) {
    scopedQuery.status = req.query.status;
  }

  if (req.query.priority) {
    scopedQuery.priority = req.query.priority;
  }

  if (req.query.search) {
    scopedQuery.$text = { $search: req.query.search };
  }

  return scopedQuery;
};

const ensureAssignableUser = async (assignedTo) => {
  if (assignedTo === undefined) {
    return null;
  }

  if (assignedTo === null) {
    return null;
  }

  const assignee = await User.findOne({
    _id: assignedTo,
    isActive: true,
    role: { $in: [USER_ROLES.AGENT, USER_ROLES.ADMIN] },
  }).select('_id role');

  if (!assignee) {
    throw new ApiError(400, 'assignedTo must reference an active agent or admin');
  }

  return assignee._id;
};

const getTicketOrThrow = async (ticketId) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }
  return ticket;
};

const buildUpdatePayloadByRole = async (req, ticket) => {
  const updatePayload = {};

  if (!canManageTicket(req.user, ticket)) {
    throw new ApiError(403, 'You are not allowed to update this ticket');
  }

  if (isAdmin(req.user)) {
    if (req.body.title !== undefined) updatePayload.title = req.body.title;
    if (req.body.description !== undefined) updatePayload.description = req.body.description;
    if (req.body.priority !== undefined) updatePayload.priority = req.body.priority;
    if (req.body.status !== undefined) updatePayload.status = req.body.status;
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      updatePayload.assignedTo = await ensureAssignableUser(req.body.assignedTo);
    }
    return updatePayload;
  }

  if (isAgent(req.user)) {
    if (req.body.status !== undefined) {
      updatePayload.status = req.body.status;
    }

    if (req.body.priority !== undefined) {
      updatePayload.priority = req.body.priority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      updatePayload.assignedTo = await ensureAssignableUser(req.body.assignedTo);
    }

    const hasAgentUpdate = Object.keys(updatePayload).length > 0;
    if (!hasAgentUpdate) {
      throw new ApiError(400, 'Agents can only update status, priority, or assignedTo');
    }

    return updatePayload;
  }

  if (isEndUser(req.user)) {
    if (!Object.prototype.hasOwnProperty.call(req.body, 'status') || req.body.status !== 'closed') {
      throw new ApiError(403, 'Users can only close their own tickets');
    }

    updatePayload.status = 'closed';
    return updatePayload;
  }

  throw new ApiError(403, 'Unsupported role for ticket updates');
};

const listTickets = asyncHandler(async (req, res) => {
  const filters = getListQueryFilters(req);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 200, maxLimit: 200 });

  const [tickets, totalCount] = await Promise.all([
    Ticket.find(filters)
      .select('-statusHistory')
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filters),
  ]);

  res.status(200).json({
    data: {
      count: tickets.length,
      totalCount,
      page,
      limit,
      totalPages: Math.max(Math.ceil(totalCount / limit), 1),
      tickets,
    },
  });
});

const createTicket = asyncHandler(async (req, res) => {
  const { title, description, priority } = req.body;

  let assignedTo = null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
    if (!isAdmin(req.user)) {
      throw new ApiError(403, 'Only admins can set assignedTo during ticket creation');
    }

    assignedTo = await ensureAssignableUser(req.body.assignedTo);
  }

  const ticket = await Ticket.create({
    title,
    description,
    priority: priority || 'medium',
    status: 'open',
    createdBy: req.user._id,
    assignedTo,
    statusHistory: [
      {
        fromStatus: null,
        toStatus: 'open',
        changedBy: req.user._id,
        note: 'Ticket created',
      },
    ],
  });

  const populated = await Ticket.findById(ticket._id)
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role');

  res.status(201).json({
    message: 'Ticket created successfully',
    data: {
      ticket: populated,
    },
  });

  emitTicketCreated(populated);
});

const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('statusHistory.changedBy', 'name email role');

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (!canAccessTicket(req.user, ticket)) {
    throw new ApiError(403, 'You are not allowed to view this ticket');
  }

  res.status(200).json({
    data: {
      ticket,
    },
  });
});

const updateTicketById = asyncHandler(async (req, res) => {
  const ticket = await getTicketOrThrow(req.params.id);
  const updatePayload = await buildUpdatePayloadByRole(req, ticket);

  const previousStatus = ticket.status;

  if (updatePayload.title !== undefined) ticket.title = updatePayload.title;
  if (updatePayload.description !== undefined) ticket.description = updatePayload.description;
  if (updatePayload.priority !== undefined) ticket.priority = updatePayload.priority;
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'assignedTo')) ticket.assignedTo = parseObjectId(updatePayload.assignedTo);

  if (updatePayload.status !== undefined) {
    ticket.status = updatePayload.status;
  }

  if (updatePayload.status !== undefined && previousStatus !== updatePayload.status) {
    ticket.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: updatePayload.status,
      changedBy: req.user._id,
      note: `Status changed by ${req.user.role}`,
    });
  }

  await ticket.save();

  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('statusHistory.changedBy', 'name email role');

  res.status(200).json({
    message: 'Ticket updated successfully',
    data: {
      ticket: updatedTicket,
    },
  });

  emitTicketUpdated(updatedTicket);
});

module.exports = {
  ticketValidators,
  listTickets,
  createTicket,
  getTicketById,
  updateTicketById,
};
