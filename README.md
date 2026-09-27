# PERN Stack ERP Technical Case Study

An Enterprise Resource Planning (ERP) application covering the complete business workflow:
**Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

---

## 🛠️ Technology Stack
- **Database**: PostgreSQL (Relational modeling with Foreign Keys, Transactions & Locking)
- **Backend**: Node.js + Express.js (REST APIs, JWT Authentication, Backend RBAC)
- **Frontend**: React.js + Vite (Clean functional user interface)
- **Authentication & Security**: JSON Web Tokens (JWT) + Password Hashing (`bcryptjs`)

---

## 🔑 Test Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@erp.com` | `Admin@123` | View all records, Manage inventory, Confirm Sales Orders (Reserve stock), Process Dispatch |
| **SALES USER** | `sales@erp.com` | `Sales@123` | Create customers, Create enquiries, Create quotations, Convert accepted quotations to Sales Orders, View inventory |

---

## 📋 Database Setup (PostgreSQL)

1. Ensure PostgreSQL service is running on `localhost:5432`.
2. Create the target database `erp_system`:
   ```bash
   psql -U postgres -c "CREATE DATABASE erp_system;"
   ```
3. Initialize Schema & Seed Data:
   ```bash
   psql -U postgres -d erp_system -f database/schema.sql
   psql -U postgres -d erp_system -f database/seed.sql
   ```

---

## ⚙️ Environment Configuration

Backend configuration file located at `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_system
DB_USER=postgres
DB_PASSWORD=Postgres@123
JWT_SECRET=erp_case_study_secret_key_2026
```

---

## 🚀 Running the Project

### 1. Start Backend Server
```bash
cd backend
npm install
node src/server.js
```
The backend server runs on `http://localhost:5000`.

### 2. Start Frontend Application
```bash
cd frontend
npm install
npm run dev
```
The frontend application will be accessible at `http://localhost:5173`.

---

## 🧪 Running Automated Tests

The application includes automated tests covering all requirements specified in the case study:
1. **Quotation Calculation**: Validates item discount %, GST %, line amounts, and grand total calculated on backend.
2. **Quotation Conversion Validation**: Prevents conversion of DRAFT or REJECTED quotations.
3. **Duplicate Prevention**: Enforces database uniqueness preventing multiple Sales Orders from a single quotation.
4. **Inventory Reservation Limit**: Prevents stock reservation exceeding available stock (`Physical - Reserved`).
5. **Role Authorization (RBAC)**: Enforces backend permission checks blocking unauthorized users (`SALES_USER`) from ADMIN operations.
6. **Simultaneous Concurrency Reservation**: Tests parallel reservation requests using row locks (`FOR UPDATE`), ensuring no over-reservation.

To run tests:
```bash
cd backend
npm test
```

To run complete E2E workflow test:
```bash
cd backend
node tests/e2e_workflow.js
```

---

## 📁 Documentation
- **Database ER Diagram & Schema**: [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md)
- **REST API Reference**: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)
- **Database Schema SQL Script**: [`database/schema.sql`](database/schema.sql)
- **Database Seed SQL Script**: [`database/seed.sql`](database/seed.sql)
