# PERN ERP REST API Documentation

Base URL: `http://localhost:5000/api`

## Authentication Header
All protected endpoints require a JWT Bearer Token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints Summary

| Category | Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| Auth | `POST` | `/auth/login` | Public | Authenticate user & get JWT token |
| Customer | `GET` | `/customers` | ADMIN, SALES_USER | Get all customers |
| Customer | `POST` | `/customers` | ADMIN, SALES_USER | Create new customer |
| Enquiry | `GET` | `/enquiries` | ADMIN, SALES_USER | Get all enquiries |
| Enquiry | `POST` | `/enquiries` | ADMIN, SALES_USER | Create enquiry with multiple products |
| Enquiry | `GET` | `/enquiries/:id` | ADMIN, SALES_USER | Get enquiry details & items |
| Quotation | `GET` | `/quotations` | ADMIN, SALES_USER | Get all quotations |
| Quotation | `POST` | `/quotations` | ADMIN, SALES_USER | Create quotation against enquiry |
| Quotation | `GET` | `/quotations/:id` | ADMIN, SALES_USER | Get quotation breakdown & line calculations |
| Quotation | `PATCH` | `/quotations/:id/status` | ADMIN, SALES_USER | Update status (`SENT`, `ACCEPTED`, `REJECTED`) |
| Quotation | `POST` | `/quotations/:id/convert` | ADMIN, SALES_USER | Convert ACCEPTED quotation to Sales Order |
| Sales Order| `GET` | `/sales-orders` | ADMIN, SALES_USER | Get all sales orders |
| Sales Order| `GET` | `/sales-orders/:id` | ADMIN, SALES_USER | Get sales order details & items |
| Sales Order| `POST` | `/sales-orders/:id/confirm`| ADMIN | Confirm order & reserve stock |
| Sales Order| `POST` | `/sales-orders/:id/dispatch`| ADMIN | Dispatch confirmed order & reduce stock |
| Inventory | `GET` | `/inventory` | ADMIN, SALES_USER | View physical, reserved & available stock |
| Product | `GET` | `/products` | ADMIN, SALES_USER | Get product master catalog |

---

## Detailed API Specifications

### 1. Auth: Login
`POST /api/auth/login`

**Request Body:**
```json
{
  "email": "sales@erp.com",
  "password": "Sales@123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "Sales Executive",
    "email": "sales@erp.com",
    "role": "SALES_USER"
  }
}
```

---

### 2. Quotation: Create Quotation
`POST /api/quotations`

**Request Body:**
```json
{
  "quotation_number": "QUO-1001",
  "enquiry_id": 1,
  "valid_until": "2026-12-31",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "discount_percent": 10,
      "gst_percent": 18
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "message": "Quotation created successfully",
  "quotation": {
    "id": 1,
    "quotation_number": "QUO-1001",
    "enquiry_id": 1,
    "status": "DRAFT",
    "subtotal": 90000,
    "total_discount": 9000,
    "total_gst": 14580,
    "grand_total": 95580
  }
}
```

---

### 3. Quotation: Convert to Sales Order
`POST /api/quotations/:id/convert`

**Response (201 Created):**
```json
{
  "message": "Sales order created successfully",
  "sales_order": {
    "id": 1,
    "order_number": "SO-1790485662542",
    "quotation_id": 1,
    "customer_id": 1,
    "total_amount": 95580,
    "status": "PENDING"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "message": "This quotation has already been converted to a Sales Order"
}
```

---

### 4. Sales Order: Confirm & Reserve Inventory (ADMIN only)
`POST /api/sales-orders/:id/confirm`

**Response (200 OK):**
```json
{
  "message": "Sales order confirmed and inventory reserved successfully",
  "sales_order": {
    "id": 1,
    "status": "CONFIRMED"
  },
  "inventory_reservation": [
    {
      "product_id": 1,
      "product_name": "Industrial Hydraulic Pump",
      "reserved_quantity": 2,
      "remaining_available": 188
    }
  ]
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "Insufficient stock for Industrial Hydraulic Pump",
  "available_quantity": 1,
  "requested_quantity": 2
}
```

---

### 5. Sales Order: Dispatch Order (ADMIN only)
`POST /api/sales-orders/:id/dispatch`

**Request Body:**
```json
{
  "dispatch_number": "DSP-1001",
  "vehicle_number": "MH-12-AB-1234",
  "driver_name": "Ramesh Singh"
}
```

**Response (201 Created):**
```json
{
  "message": "Dispatch created successfully",
  "sales_order": {
    "id": 1,
    "status": "DISPATCHED"
  }
}
```
