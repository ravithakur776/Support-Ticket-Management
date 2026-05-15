# Support Ticket Management System

Production-style full-stack support desk application built with the MEAN ecosystem and real-time updates.

## Overview
This project helps teams manage customer and IT support workflows with role-based access, ticket lifecycle tracking, comments, admin controls, and live updates.

## Tech Stack
- Frontend: Angular 21, Angular Material, RxJS, Socket.IO client
- Backend: Node.js, Express 5, Mongoose, Socket.IO
- Database: MongoDB
- Auth/Security: JWT, bcrypt, HTTP-only cookies, CORS, Helmet, rate limiting, XSS sanitization

## Core Features
- Authentication: register, login, logout, current user profile
- RBAC: user, agent, admin permissions
- Ticket management: create, list, filter, update, close
- Comment threads per ticket
- Status history tracking
- Real-time events: ticket created/updated, comment created
- Admin user management: list, update role/status, disable accounts
- Dashboard metrics and queue visibility

## Project Structure
```text
Support Ticket System Project/
  backend/
    src/
      config/
      controllers/
      middlewares/
      models/
      routes/
      services/
      utils/
      app.js
      server.js
  frontend/
    src/
      app/
        components/
        core/
        models/
      environments/
```

## Getting Started
### Prerequisites
- Node.js 20+
- MongoDB instance (local or cloud)

### 1) Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
Update `backend/.env`:
- `MONGO_URI`
- `JWT_SECRET`
- optional: `CORS_ORIGIN`, `TRUST_PROXY`, `PORT`

Run backend:
```bash
npm run dev
```
Backend default URL: `http://127.0.0.1:5001`

### 2) Frontend Setup
```bash
cd frontend
npm install
npm start -- --host 127.0.0.1 --port 4200
```
Frontend URL: `http://127.0.0.1:4200`

## API Base
`/api`

Main route groups:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /tickets`
- `POST /tickets`
- `GET /tickets/:id`
- `PUT /tickets/:id`
- `GET /tickets/:id/comments`
- `POST /tickets/:id/comments`
- `GET /users` (admin)
- `PUT /users/:id` (admin)
- `DELETE /users/:id` (admin)

## Performance & Stability Notes
- Route lazy loading with preloading for faster navigation
- API pagination support for ticket/user/comment listing
- Realtime-driven UI refreshes are throttled to reduce request bursts
- Centralized error handling and secure middleware defaults

## Build Commands
### Frontend
```bash
cd frontend
npm run build
```

### Backend
```bash
cd backend
npm start
```

## Deployment Notes
- Set production-safe `JWT_SECRET` and `MONGO_URI`
- Configure `CORS_ORIGIN` to your deployed frontend URL
- Set `NODE_ENV=production`
- Enable secure transport (HTTPS)

## Repository
GitHub: https://github.com/ravithakur776/Support-Ticket-Management



..
