const express = require('express');
const validateRequest = require('../middlewares/validateRequest');
const { protect } = require('../middlewares/auth.middleware');
const {
  ticketValidators,
  listTickets,
  createTicket,
  getTicketById,
  updateTicketById,
} = require('../controllers/ticket.controller');
const { commentValidators, getCommentsByTicketId, createComment } = require('../controllers/comment.controller');

const router = express.Router();

router.use(protect);

router.get('/', ticketValidators.list, validateRequest, listTickets);
router.post('/', ticketValidators.create, validateRequest, createTicket);
router.get('/:id', ticketValidators.byId, validateRequest, getTicketById);
router.put('/:id', ticketValidators.update, validateRequest, updateTicketById);

router.get('/:id/comments', commentValidators.listForTicket, validateRequest, getCommentsByTicketId);
router.post('/:id/comments', commentValidators.createForTicket, validateRequest, createComment);

module.exports = router;
