const mongoose = require('mongoose');
const { TICKET_PRIORITIES, TICKET_STATUSES } = require('../utils/constants');

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: TICKET_STATUSES,
      default: null,
    },
    toStatus: {
      type: String,
      enum: TICKET_STATUSES,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Ticket title is required'],
      trim: true,
      minlength: 5,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'open',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

ticketSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Ticket', ticketSchema);
