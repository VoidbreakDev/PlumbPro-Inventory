# PlumbPro Inventory - Backend Server

Backend API for PlumbPro Inventory Management System built with Node.js, Express, and PostgreSQL.

## Features

- **RESTful API** - Complete CRUD operations for all resources
- **JWT Authentication** - Secure user authentication and authorization
- **PostgreSQL Database** - Robust relational database with proper schema
- **Multi-tenancy** - Data isolation per user/company
- **AI Integration** - Google Gemini AI for smart ordering suggestions
- **Stock Management** - Complete audit trail of all stock movements
- **Role-based Access** - Admin, Manager, User, and Viewer roles

## Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **npm** or **yarn**

## Installation

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE plumbpro_inventory;

# Exit psql
\q
```

### 3. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cp .env.example .env
```

Edit `.env` and update with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=plumbpro_inventory
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 4. Run Database Migration

Create the database tables:

```bash
npm run migrate
```

### 5. Seed Database (Optional)

Populate the database with demo data:

```bash
npm run seed
```

This creates:
- Demo user (email: demo@plumbpro.com, password: demo123)
- Sample contacts (suppliers and plumbers)
- Sample inventory items
- Job templates
- Sample job

## Running the Server

### Development Mode

```bash
npm run dev
```

Server will start on http://localhost:5000 with auto-restart on file changes.

### Production Mode

```bash
npm start
```

## API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

All endpoints except `/api/auth/login` and `/api/auth/register` require authentication.

Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Endpoints

#### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

#### Inventory

- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create new item
- `PUT /api/inventory/:id` - Update item
- `POST /api/inventory/:id/adjust` - Adjust stock manually
- `DELETE /api/inventory/:id` - Delete item

#### Contacts

- `GET /api/contacts` - Get all contacts (filter by ?type=Supplier)
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

#### Jobs

- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get single job
- `POST /api/jobs` - Create job
- `PUT /api/jobs/:id` - Update job
- `POST /api/jobs/:id/pick` - Pick job (remove stock)
- `DELETE /api/jobs/:id` - Delete job

#### Templates

- `GET /api/templates` - Get all templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

#### Stock Movements

- `GET /api/movements` - Get stock movements (supports filters)

#### Smart Ordering

- `POST /api/smart-ordering/suggestions` - Generate AI order suggestions

### Example Requests

#### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@plumbpro.com","password":"demo123"}'
```

#### Get Inventory (with auth)

```bash
curl http://localhost:5000/api/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Inventory Item

```bash
curl -X POST http://localhost:5000/api/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "15mm Copper Pipe",
    "category": "Pipes",
    "price": 12.50,
    "quantity": 50,
    "reorderLevel": 20,
    "supplierCode": "CP-15-3M"
  }'
```

## Database Schema

### Tables

- `users` - User accounts and authentication
- `contacts` - Suppliers, plumbers, and customers
- `inventory_items` - Stock items
- `jobs` - Scheduled jobs
- `job_workers` - Job-to-worker assignments (many-to-many)
- `job_allocated_items` - Job-to-item allocations (many-to-many)
- `job_templates` - Reusable job templates
- `template_items` - Template-to-item relationships
- `stock_movements` - Complete audit trail

## Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- SQL injection prevention (parameterized queries)
- CORS protection
- Environment variable secrets
- User data isolation (multi-tenancy)

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

Error responses include a JSON body:

```json
{
  "error": "Error message here",
  "details": []
}
```

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running:
   ```bash
   sudo service postgresql status
   ```

2. Check database credentials in `.env`

3. Verify database exists:
   ```bash
   psql -U postgres -l
   ```

### Port Already in Use

If port 5000 is in use, change `PORT` in `.env` file.

### CORS Errors

Update `CORS_ORIGIN` in `.env` to match your frontend URL.

## Development

### Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── database.js       # Database connection pool
│   ├── db/
│   │   ├── schema.sql        # Database schema
│   │   ├── migrate.js        # Migration script
│   │   └── seed.js           # Seed script
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   └── validation.js     # Validation middleware
│   ├── routes/
│   │   ├── auth.js           # Auth endpoints
│   │   ├── inventory.js      # Inventory endpoints
│   │   ├── contacts.js       # Contact endpoints
│   │   ├── jobs.js           # Job endpoints
│   │   ├── templates.js      # Template endpoints
│   │   ├── movements.js      # Movement endpoints
│   │   └── smartOrdering.js  # AI suggestions
│   └── server.js             # Main server file
├── package.json
├── .env.example
└── README.md
```

## License

MIT
