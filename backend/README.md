# Support Ticket System - Backend (Phase 1-3)

This backend provides the Phase 1 foundation:
- Express server bootstrap
- MongoDB connection via Mongoose
- User model and authentication APIs
- JWT auth middleware and role-based authorization middleware
- Security middleware (helmet, CORS, rate limiting, sanitize, centralized error handling)
- Phase 2 ticket/comment APIs with RBAC and status history
- Phase 3 admin user management APIs and Socket.io real-time foundation

## Prerequisites
- Node.js 20+
- MongoDB running locally or a cloud MongoDB URI

## Setup
1. Install dependencies:
   - `npm install`
2. Copy env template:
   - `cp .env.example .env`
3. Update `.env` values (`MONGO_URI`, `JWT_SECRET`, etc.)
4. Start server:
   - Dev: `npm run dev`
   - Prod: `npm start`

## Phase 1 Endpoints
Base path: `/api`

- `GET /health` - API health check
- `POST /auth/register` - Register user and issue JWT
- `POST /auth/login` - Login and issue JWT
- `POST /auth/logout` - Clear auth cookie
- `GET /auth/me` - Current authenticated user (requires token)

## Phase 2 Endpoints
All routes below require authentication:

- `GET /tickets` - List tickets scoped by role (admin: all, agent: assigned, user: own). Supports `status`, `priority`, `search`.
- `POST /tickets` - Create ticket (admin may optionally set `assignedTo`).
- `GET /tickets/:id` - View ticket (participants/admin only).
- `PUT /tickets/:id` - Update ticket (role-restricted updates).
- `GET /tickets/:id/comments` - List ticket comments.
- `POST /tickets/:id/comments` - Add a ticket comment.

## Phase 3 Endpoints
Admin-only routes:

- `GET /users` - List all users (supports `role`, `isActive`, `search`).
- `PUT /users/:id` - Update user profile/role/status/password.
- `DELETE /users/:id` - Disable user account (`isActive = false`).

## Socket.io Foundation
Socket connections require a valid JWT (from `auth.token`, `Authorization` header, or `token` cookie).

Rooms joined on connect:
- `user:<userId>`
- `role:<role>`

Current emitted server events:
- `ticket:created`
- `ticket:assigned`
- `ticket:updated`
- `comment:created`

## Authentication
`protect` middleware accepts token from either:
- HTTP-only cookie: `token`
- Authorization header: `Bearer <jwt>`

## Role-Based Access Control
`authorize(...roles)` middleware enforces route-level role access.
This is ready to apply in Phase 2+ routes.



..
