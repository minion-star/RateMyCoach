# Rate Your Coach

## Overview

Rate Your Coach is a professional coach reviewing platform focused on transparency, trust, and real athlete experiences. The application allows athletes to find coaches, read verified reviews, and submit their own feedback. Coaches can be searched by name and sport, with detailed profile pages showing ratings and reviews.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with custom design system variables
- **UI Components**: shadcn/ui component library (Radix UI primitives)
- **Animations**: Framer Motion for hero and card animations
- **Build Tool**: Vite with React plugin

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable components in `client/src/components/`
- Custom hooks for data fetching in `client/src/hooks/`
- Shared UI primitives in `client/src/components/ui/`

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript
- **HTTP Server**: Node.js native `http.createServer`
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Development**: Vite middleware for HMR in development mode
- **Production**: Static file serving from built assets

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with push-based schema synchronization

Database tables:
- `users`: Stores registered users with name, email, hashed password, instagram, profile picture, isAthlete/isCoach roles, role (user/admin), and timestamp
- `coaches`: Stores coach profiles with userId reference, name, sport, phone, instagram, image, rating, and review count
- `reviews`: Stores reviews with coach reference, overall rating, detailed ratings (responseTime, knowledge, results, communication), comment, author name, status (pending/approved/rejected), proofUrl, and timestamp

### API Structure
Routes are defined declaratively in `shared/routes.ts` with:
- Path definitions
- HTTP methods
- Input validation schemas (Zod)
- Response type schemas

Current endpoints:
- `GET /api/coaches` - List coaches with optional search filter
- `GET /api/coaches/:id` - Get single coach by ID
- `POST /api/reviews` - Create a new review (requires athlete authentication, status defaults to pending)
- `POST /api/auth/register` - Register new user (athlete/coach) with verification answer validation
- `POST /api/auth/login` - Log in with email and password
- `POST /api/auth/logout` - Log out current session
- `GET /api/auth/me` - Get current authenticated user

Admin endpoints (require admin role):
- `GET /api/admin/reviews` - List pending reviews with coach and athlete details
- `POST /api/admin/reviews/:id/approve` - Approve a pending review
- `POST /api/admin/reviews/:id/reject` - Reject a pending review

### Authentication System
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Password Security**: bcrypt for password hashing
- **Session Cookies**: HTTP-only cookies with secure session ID
- **Auth Context**: React context provider (`AuthProvider`) for client-side auth state
- **Role-Based Access**: Only athletes can submit reviews; coaches cannot review themselves

### Design System
Custom design tokens defined in CSS variables:
- Header background: `#202020`
- Primary accent: `#F5C518` (yellow for CTAs)
- Typography: Montserrat font family
- Custom button styles for primary actions (Write a Review, Sign in, Register)

### File Storage
- **Object Storage**: Replit's built-in cloud storage for profile pictures
- **Upload Flow**: Files uploaded via presigned URLs directly to cloud storage
- **Serving**: Uploaded images served from `/objects/uploads/:id` endpoint

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store for authentication sessions

### Core Libraries
- **Drizzle ORM**: Database queries and schema management
- **Zod**: Runtime type validation for API inputs and outputs
- **TanStack Query**: Client-side data fetching and caching

### UI/UX Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Framer Motion**: Animation library
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **Tailwind CSS**: Utility-first styling

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development