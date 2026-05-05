const { body, param, query } = require('express-validator');
const Comment = require('../models/comment.model');
const Ticket = require('../models/ticket.model');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/apiError');
const { getPagination } = require('../utils/pagination');
const { canAccessTicket } = require('../services/ticketAccess.service');
const { emitCommentCreated } = require('../services/realtime.service');

const commentValidators = {
  listForTicket: [
    param('id').isMongoId().withMessage('Valid ticket id is required'),
    query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 300 }).withMessage('limit must be between 1 and 300'),
  ],
  createForTicket: [
    param('id').isMongoId().withMessage('Valid ticket id is required'),
    body('content').trim().isLength({ min: 1, max: 3000 }).withMessage('content must be between 1 and 3000 characters'),
  ],
};

const getAccessibleTicket = async (ticketId, user) => {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (!canAccessTicket(user, ticket)) {
    throw new ApiError(403, 'You are not allowed to access comments for this ticket');
  }

  return ticket;
};

const getCommentsByTicketId = asyncHandler(async (req, res) => {
  await getAccessibleTicket(req.params.id, req.user);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 150, maxLimit: 300 });

  const [comments, totalCount] = await Promise.all([
    Comment.find({ ticketId: req.params.id })
      .populate('authorId', 'name email role')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments({ ticketId: req.params.id }),
  ]);

  res.status(200).json({
    data: {
      count: comments.length,
      totalCount,
      page,
      limit,
      totalPages: Math.max(Math.ceil(totalCount / limit), 1),
      comments,
    },
  });
});

const createComment = asyncHandler(async (req, res) => {
  const ticket = await getAccessibleTicket(req.params.id, req.user);

  const comment = await Comment.create({
    ticketId: req.params.id,
    authorId: req.user._id,
    content: req.body.content,
  });

  // Keep ticket ordering by activity accurate for dashboards and list screens.
  await Ticket.updateOne({ _id: req.params.id }, { $set: { updatedAt: new Date() } });

  const populatedComment = await Comment.findById(comment._id).populate('authorId', 'name email role');

  res.status(201).json({
    message: 'Comment added successfully',
    data: {
      comment: populatedComment,
    },
  });

  emitCommentCreated(populatedComment, ticket);
});

module.exports = {
  commentValidators,
  getCommentsByTicketId,
  createComment,
};
