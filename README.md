markdown
# POS Billing System - API Documentation

A comprehensive Point of Sale (POS) billing system backend built with Node.js, Express, TypeScript, and SQLite.

## 📋 Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Modules](#api-modules)
  - [Auth](#auth)
  - [Products](#products)
  - [Carts](#carts)
  - [Sales](#sales)
  - [Customers](#customers)
  - [Suppliers](#suppliers)
  - [Purchases](#purchases)
  - [Settings](#settings)
  - [Staff](#staff)
  - [Reports](#reports)
- [Error Codes](#error-codes)

---

## Base URL
http://localhost:3000/api

text

## Authentication

All protected endpoints require a JWT token in the Authorization header:
Authorization: Bearer YOUR_JWT_TOKEN

text

---

## API Modules

---

### Auth

Authentication endpoints for user registration and login.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new shop & admin | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/me` | Get current user profile | Yes |
| POST | `/auth/logout` | Logout user | Yes |

#### Register New Shop & Admin

http
POST /api/auth/register
Request Body

json
{
  "shop_name": "My Shop",
  "name": "Admin",
  "email": "admin@test.com",
  "password": "123456"
}
Response 201 Created

json
{
  "user": {
    "user_uuid": "uuid-here",
    "name": "Admin",
    "email": "admin@test.com",
    "role": "owner"
  },
  "shop": {
    "id": 1,
    "shop_name": "My Shop",
    "invoice_prefix": "INV"
  },
  "token": "jwt-token-here"
}
Login
http
POST /api/auth/login
Request Body

json
{
  "email": "admin@test.com",
  "password": "123456"
}
Response 200 OK

json
{
  "user": {
    "user_uuid": "uuid-here",
    "name": "Admin",
    "email": "admin@test.com",
    "role": "owner"
  },
  "shop": {
    "id": 1,
    "shop_name": "My Shop"
  },
  "token": "jwt-token-here"
}

### Products
Product management endpoints.

Method	Endpoint	Description	Auth
GET	/products	List all products	Yes
GET	/products/search?q=	Search products by name	Yes
GET	/products/barcode/:barcode	Find product by barcode	Yes
GET	/products/sku/:sku	Find product by SKU	Yes
GET	/products/low-stock?threshold=10	Get low stock products	Yes
POST	/products	Create product	Yes
POST	/products/bulk	Bulk create products	Yes
GET	/products/:uuid	Get single product	Yes
PUT	/products/:uuid	Update product	Yes
DELETE	/products/:uuid	Delete product	Yes
Create Product
http
POST /api/products
Request Body

json
{
  "name": "Product Name",
  "price": 99.99,
  "barcode": "123456789",
  "sku": "SKU001",
  "gst_percent": 18,
  "stock": 50
}
Field	Type	Required	Description
name	string	Yes	Product name
price	number	Yes	Selling price
barcode	string	No	Barcode number
sku	string	No	Stock Keeping Unit
gst_percent	number	No	GST percentage (default: 0)
stock	number	No	Initial stock quantity (default: 0)
Response 201 Created

json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "product_uuid": "uuid-here",
    "name": "Product Name",
    "barcode": "123456789",
    "sku": "SKU001",
    "price": 99.99,
    "gst_percent": 18,
    "stock": 50,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
List Products (Paginated)
http
GET /api/products?page=1&limit=20
Response 200 OK

json
{
  "success": true,
  "data": [ /* array of products */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
Search Products
http
GET /api/products/search?q=Product
Response 200 OK

json
{
  "success": true,
  "data": [ /* array of matching products */ ],
  "count": 5
}
Find by Barcode
http
GET /api/products/barcode/123456789
Find by SKU
http
GET /api/products/sku/SKU001
Update Product
http
PUT /api/products/:uuid
Request Body (All fields optional)

json
{
  "name": "Updated Name",
  "price": 149.99,
  "stock": 100
}
Delete Product
http
DELETE /api/products/:uuid
Get Low Stock Products
http
GET /api/products/low-stock?threshold=10
Bulk Create Products
http
POST /api/products/bulk
Request Body

json
{
  "products": [
    {"name": "Product A", "price": 10.99},
    {"name": "Product B", "price": 20.99},
    {"name": "Product C", "price": 15.99}
  ]
}

### Carts
Shopping cart management for POS transactions.

Method	Endpoint	Description	Auth
POST	/carts	Create new cart	Yes
GET	/carts/held	Get held carts	Yes
GET	/carts/:cart_uuid	Get cart with items & summary	Yes
POST	/carts/:cart_uuid/items	Add item to cart	Yes
PUT	/carts/:cart_uuid/items/:product_uuid	Update cart item	Yes
DELETE	/carts/:cart_uuid/items/:product_uuid	Remove item from cart	Yes
POST	/carts/:cart_uuid/discount	Apply bill discount	Yes
POST	/carts/:cart_uuid/hold	Hold cart	Yes
POST	/carts/:cart_uuid/resume	Resume held cart	Yes
POST	/carts/:cart_uuid/clear	Clear all items	Yes
POST	/carts/:cart_uuid/checkout	Checkout cart (Owner/Manager/Cashier)	Yes
Create Cart
http
POST /api/carts
Response 201 Created

json
{
  "success": true,
  "message": "Cart created successfully",
  "data": {
    "cart_uuid": "uuid-here",
    "status": "active",
    "discount": 0.00,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
Get Cart with Items & Summary
http
GET /api/carts/:cart_uuid
Response 200 OK

json
{
  "success": true,
  "data": {
    "cart_uuid": "uuid-here",
    "status": "active",
    "discount": 10.00,
    "items": [
      {
        "id": 1,
        "product_uuid": "uuid-here",
        "quantity": 2,
        "price": 99.99,
        "discount": 0.00,
        "tax_percent": 18,
        "product": {
          "name": "Product Name",
          "barcode": "123456789"
        }
      }
    ],
    "summary": {
      "total": 199.98,
      "item_discount": 0.00,
      "bill_discount": 10.00,
      "tax": 34.20,
      "grand_total": 224.18
    }
  }
}
Add Item to Cart
http
POST /api/carts/:cart_uuid/items
Request Body

json
{
  "product_uuid": "product-uuid-here",
  "quantity": 2
}
Update Cart Item
http
PUT /api/carts/:cart_uuid/items/:product_uuid
Request Body

json
{
  "quantity": 5,
  "price": 89.99,
  "discount": 5.00,
  "tax_percent": 12
}
Remove Item from Cart
http
DELETE /api/carts/:cart_uuid/items/:product_uuid
Apply Bill Discount
http
POST /api/carts/:cart_uuid/discount
Request Body

json
{
  "discount": 50.00
}
Hold Cart
http
POST /api/carts/:cart_uuid/hold
Resume Held Cart
http
POST /api/carts/:cart_uuid/resume
Clear Cart
http
POST /api/carts/:cart_uuid/clear
Checkout Cart
http
POST /api/carts/:cart_uuid/checkout
Request Body

json
{
  "customer_uuid": "customer-uuid-here",
  "payments": [
    {
      "method": "cash",
      "amount": 500.00,
      "reference": "optional-reference"
    },
    {
      "method": "upi",
      "amount": 224.18,
      "reference": "TXN123456"
    }
  ]
}
Payment Methods: cash, upi, card, credit

Response 201 Created

json
{
  "success": true,
  "message": "Checkout successful",
  "data": {
    "sale_uuid": "uuid-here",
    "invoice_number": "INV-00001",
    "customer_uuid": "customer-uuid-here",
    "total": 599.97,
    "tax": 68.39,
    "grand_total": 648.36,
    "status": "completed",
    "items": [ /* array of sale items */ ],
    "payments": [ /* array of payments */ ]
  }
}

### Sales
Sale transaction management.

Method	Endpoint	Description	Auth
GET	/sales	List all sales	Yes
POST	/sales	Direct sale (without cart)	Yes
GET	/sales/:sale_uuid	Get sale details	Yes
GET	/sales/:sale_uuid/invoice	Get invoice details	Yes
List Sales
http
GET /api/sales?page=1&limit=20
Response 200 OK

json
{
  "success": true,
  "data": [ /* array of sales */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
Direct Sale
http
POST /api/sales
Request Body

json
{
  "customer_uuid": "optional-customer-uuid",
  "items": [
    {
      "product_uuid": "product-uuid-1",
      "quantity": 5
    },
    {
      "product_uuid": "product-uuid-2",
      "quantity": 3
    }
  ],
  "payments": [
    {
      "method": "cash",
      "amount": 1000.00
    }
  ]
}
Get Invoice
http
GET /api/sales/:sale_uuid/invoice
Response 200 OK

json
{
  "shop": {
    "name": "My Shop",
    "mobile": "9876543210",
    "address": "123 Main St, City",
    "gstin": "GSTIN123456"
  },
  "invoice_number": "INV-00001",
  "date": "2024-01-15T10:30:00.000Z",
  "customer": {
    "name": "John Doe",
    "mobile": "9876543210"
  },
  "items": [
    {
      "name": "Product 1",
      "qty": 2,
      "price": 99.99,
      "total": 199.98,
      "tax_percent": 18,
      "tax_amount": 36.00
    }
  ],
  "summary": {
    "total": 199.98,
    "tax": 36.00,
    "cgst": 18.00,
    "sgst": 18.00,
    "grand_total": 235.98
  },
  "payments": [
    {
      "method": "cash",
      "amount": 235.98
    }
  ]
}
### Customers
Customer management and credit tracking.

Method	Endpoint	Description	Auth
GET	/customers	List all customers	Yes
GET	/customers/search?q=	Search customers	Yes
GET	/customers/summary	Get credit summary	Yes
GET	/customers/aging	Get credit aging report	Yes
GET	/customers/reminders	Get payment reminders	Yes
POST	/customers	Create customer	Yes
GET	/customers/:customer_uuid	Get customer details	Yes
PUT	/customers/:customer_uuid	Update customer	Yes
DELETE	/customers/:customer_uuid	Delete customer	Yes
GET	/customers/:customer_uuid/ledger	Get customer ledger	Yes
POST	/customers/:customer_uuid/payments	Record payment	Yes
Create Customer
http
POST /api/customers
Request Body

json
{
  "name": "John Doe",
  "mobile": "9876543210",
  "address": "123 Main St, City",
  "gstin": "GST123456",
  "credit_limit": 10000
}
Field	Type	Required	Description
name	string	Yes	Customer name
mobile	string	No	Phone number
address	string	No	Address
gstin	string	No	GST number
credit_limit	number	No	Maximum credit allowed (default: 0)
Response 201 Created

json
{
  "success": true,
  "data": {
    "customer_uuid": "uuid-here",
    "name": "John Doe",
    "mobile": "9876543210",
    "address": "123 Main St, City",
    "gstin": "GST123456",
    "credit_balance": 0.00,
    "credit_limit": 10000.00,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
Record Customer Payment
http
POST /api/customers/:customer_uuid/payments
Request Body

json
{
  "amount": 500.00,
  "method": "cash"
}
Get Customer Ledger
http
GET /api/customers/:customer_uuid/ledger
Response 200 OK

json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customer_uuid": "uuid-here",
      "type": "sale",
      "amount": 1000.00,
      "reference_uuid": "sale-uuid-here",
      "note": "Sale invoice #INV-00001",
      "balance": 1000.00,
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "customer_uuid": "uuid-here",
      "type": "payment",
      "amount": 500.00,
      "reference_uuid": null,
      "note": "Payment via cash",
      "balance": 500.00,
      "created_at": "2024-01-16T10:30:00.000Z"
    }
  ]
}
Get Customer Summary
http
GET /api/customers/summary
Response 200 OK

json
{
  "success": true,
  "data": {
    "total_credit": 25000.00,
    "customers_with_credit": 5,
    "top_debtors": [
      {
        "name": "John Doe",
        "credit_balance": 10000.00
      },
      {
        "name": "Jane Smith",
        "credit_balance": 7500.00
      }
    ]
  }
}
Get Aging Report
http
GET /api/customers/aging
Response 200 OK

json
{
  "success": true,
  "data": [
    {
      "name": "John Doe",
      "credit_balance": 10000.00,
      "aging": {
        "0_30": 3000.00,
        "31_60": 5000.00,
        "61_90": 2000.00,
        "90_plus": 0.00
      }
    }
  ]
}
Get Payment Reminders
http
GET /api/customers/reminders
Response 200 OK

json
{
  "success": true,
  "data": [
    {
      "name": "John Doe",
      "mobile": "9876543210",
      "due": 10000.00,
      "days": 30
    }
  ]
}
Suppliers
Supplier/vendor management.

Method	Endpoint	Description	Auth
GET	/suppliers	List all suppliers	Yes
POST	/suppliers	Create supplier	Yes
PUT	/suppliers/:supplier_uuid	Update supplier	Yes
DELETE	/suppliers/:supplier_uuid	Delete supplier	Yes
List Suppliers
http
GET /api/suppliers
Response 200 OK

json
[
  {
    "supplier_uuid": "uuid-here",
    "name": "ABC Supplies",
    "phone": "9876543210",
    "email": "abc@supplies.com",
    "address": "123 Business Park, Mumbai",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
]
Create Supplier
http
POST /api/suppliers
Request Body

json
{
  "name": "ABC Supplies",
  "phone": "9876543210",
  "email": "abc@supplies.com",
  "address": "123 Business Park, Mumbai"
}
Update Supplier
http
PUT /api/suppliers/:supplier_uuid
Request Body (All fields optional)

json
{
  "name": "Updated Name",
  "phone": "9999999999"
}
Delete Supplier
http
DELETE /api/suppliers/:supplier_uuid
Response 200 OK

json
{
  "message": "Deleted"
}
### Purchases
Purchase order management.

Method	Endpoint	Description	Auth
GET	/purchases	List all purchases	Yes
POST	/purchases	Create purchase	Yes
Create Purchase
http
POST /api/purchases
Request Body

json
{
  "supplier_uuid": "supplier-uuid-here",
  "items": [
    {
      "product_uuid": "product-uuid-1",
      "quantity": 10,
      "cost_price": 50.00
    },
    {
      "product_uuid": "product-uuid-2",
      "quantity": 5,
      "cost_price": 75.00
    }
  ]
}
Field	Type	Required	Description
supplier_uuid	UUID	No	Supplier identifier
items	array	Yes	Array of purchase items
items[].product_uuid	UUID	Yes	Product identifier
items[].quantity	number	Yes	Quantity purchased (min: 1)
items[].cost_price	number	Yes	Cost price per unit (min: 0)
Response 201 Created

json
{
  "success": true,
  "message": "Purchase created",
  "data": {
    "purchase_uuid": "uuid-here",
    "total": 875.00,
    "supplier_uuid": "supplier-uuid-here",
    "items": [
      {
        "id": 1,
        "purchase_uuid": "uuid-here",
        "product_uuid": "product-uuid-1",
        "quantity": 10,
        "cost_price": 50.00,
        "product": {
          "name": "Product 1"
        }
      }
    ],
    "supplier": {
      "supplier_uuid": "supplier-uuid-here",
      "name": "ABC Supplies"
    }
  }
}
List Purchases
http
GET /api/purchases
Response 200 OK

json
[
  {
    "purchase_uuid": "uuid-here",
    "total": 875.00,
    "supplier_uuid": "supplier-uuid-here",
    "items": [ /* array of purchase items with product details */ ],
    "supplier": {
      "supplier_uuid": "supplier-uuid-here",
      "name": "ABC Supplies"
    }
  }
]
Settings
Shop settings management (Owner only for create/update).

Method	Endpoint	Description	Auth	Role
GET	/settings	Get shop settings	Yes	Any
POST	/settings	Create/Update settings	Yes	Owner
PUT	/settings	Update settings	Yes	Owner
Get Settings
http
GET /api/settings
Response 200 OK

json
{
  "success": true,
  "data": {
    "id": 1,
    "shop_name": "My Shop",
    "mobile": "9876543210",
    "address": "123 Main St, City",
    "gstin": "GSTIN123456",
    "invoice_prefix": "INV",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
Save/Create Settings
http
POST /api/settings
Request Body

json
{
  "shop_name": "My Shop",
  "mobile": "9876543210",
  "address": "123 Main St, City",
  "gstin": "GSTIN123456",
  "invoice_prefix": "INV"
}
Field	Type	Required	Description
shop_name	string	Yes	Shop/Store name
mobile	string	No	Contact number
address	string	No	Shop address
gstin	string	No	GST number (India)
invoice_prefix	string	No	Invoice number prefix (default: INV)
Staff
Staff/user management (Owner only).

Method	Endpoint	Description	Auth	Role
GET	/staff	List all staff	Yes	Owner
GET	/staff/summary	Staff summary	Yes	Owner
GET	/staff/role/:role	Staff by role	Yes	Owner
POST	/staff	Create staff	Yes	Owner
PUT	/staff/:user_uuid	Update staff	Yes	Owner
DELETE	/staff/:user_uuid	Delete staff	Yes	Owner
Create Staff Member
http
POST /api/staff
Request Body

json
{
  "name": "John Cashier",
  "email": "cashier@test.com",
  "password": "123456",
  "role": "cashier"
}
Field	Type	Required	Description
name	string	Yes	Staff name
email	string	Yes	Unique email
password	string	Yes	Password (min: 6 chars)
role	string	Yes	Role: manager or cashier
Response 201 Created

json
{
  "user_uuid": "uuid-here",
  "name": "John Cashier",
  "email": "cashier@test.com",
  "role": "cashier",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
List All Staff
http
GET /api/staff
Response 200 OK

json
[
  {
    "user_uuid": "uuid-here",
    "name": "John Cashier",
    "email": "cashier@test.com",
    "role": "cashier",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
]
Update Staff Member
http
PUT /api/staff/:user_uuid
Request Body (All fields required for update)

json
{
  "name": "John Updated",
  "email": "cashier2@test.com",
  "role": "manager",
  "password": "newpassword"
}
Delete Staff Member
http
DELETE /api/staff/:user_uuid
Response 200 OK

json
{
  "message": "Staff deleted"
}
Staff Summary
http
GET /api/staff/summary
Response 200 OK

json
{
  "staff_by_role": [
    { "role": "manager", "count": 2 },
    { "role": "cashier", "count": 5 }
  ],
  "total_staff": 7
}
Staff by Role
http
GET /api/staff/role/cashier
Reports
Analytics and reporting endpoints.

Method	Endpoint	Description	Auth
GET	/reports/dashboard	Dashboard summary	Yes
GET	/reports/top-products	Top selling products	Yes
GET	/reports/stock	Stock report	Yes
GET	/reports/profit	Profit estimation	Yes
GET	/reports/sales-trend	Sales trend (7 days)	Yes
GET	/reports/profit-trend	Profit trend (7 days)	Yes
GET	/reports/sales-by-payment	Sales by payment method	Yes
GET	/reports/daily-sales	Daily sales summary	Yes
GET	/reports/product-sales	Product sales report	Yes
GET	/reports/customer-purchases	Customer purchase history	Yes
Dashboard
http
GET /api/reports/dashboard
Response 200 OK

json
{
  "today_sales": 5000.00,
  "month_sales": 125000.00,
  "total_sales": 1500000.00,
  "total_orders": 500,
  "recent_sales": [ /* last 5 sales */ ],
  "low_stock": [ /* products with stock < 10 */ ],
  "top_products": [
    {
      "name": "Product A",
      "total_qty": 150
    }
  ],
  "recent_purchases": [ /* last 5 purchases */ ]
}
Top Products
http
GET /api/reports/top-products
Stock Report
http
GET /api/reports/stock
Response 200 OK

json
[
  {
    "name": "Product A",
    "stock": 25,
    "price": 99.99
  }
]
Profit Estimation
http
GET /api/reports/profit
Response 200 OK

json
{
  "revenue": 1500000.00,
  "cost": 1000000.00,
  "profit": 500000.00
}
Sales Trend (Last 7 Days)
http
GET /api/reports/sales-trend
Response 200 OK

json
[
  {
    "date": "2024-01-09",
    "total": 5000.00
  },
  {
    "date": "2024-01-10",
    "total": 7500.00
  }
]
Profit Trend (Last 7 Days)
http
GET /api/reports/profit-trend
Response 200 OK

json
[
  {
    "date": "2024-01-09",
    "revenue": 5000.00,
    "cost": 3000.00,
    "profit": 2000.00
  }
]
Sales by Payment Method
http
GET /api/reports/sales-by-payment?startDate=2024-01-01&endDate=2024-01-31
Daily Sales Summary
http
GET /api/reports/daily-sales?days=30
Product Sales Report
http
GET /api/reports/product-sales?startDate=2024-01-01&endDate=2024-01-31
Customer Purchase Report
http
GET /api/reports/customer-purchases
Error Codes
Status Code	Description
200	OK - Successful request
201	Created - Resource created successfully
400	Bad Request - Invalid input/validation error
401	Unauthorized - Missing or invalid authentication
403	Forbidden - Insufficient permissions
404	Not Found - Resource not found
500	Internal Server Error
Error Response Format
json
{
  "success": false,
  "error": "Error message description"
}

### User Roles
Role	Description	Permissions
owner	Shop owner/admin	Full access to all features
manager	Store manager	Sales, reports, product management
cashier	Counter staff	POS operations, cart checkout

---

## 📅 June 5, 2026 — Manufacturer field in Top Products report

Added `manufacturer` field to the top products query so the manufacturer name is included in the API response.

### Backend changes

| File | Change |
|------|--------|
| `server/src/models/Report.ts` | Added `p.manufacturer` to SQL SELECT in `getTopProducts()`; mapped `manufacturerName` in the response object |

### API

```
GET /api/reports/top-products
```

Response:
```json
[
  {
    "product_uuid": "uuid",
    "name": "Product A",
    "manufacturerName": "Micro Labs Ltd",
    "total_qty": 150,
    "total_revenue": 29999.99
  }
]
```

---

---

## 📅 June 6, 2026 — GST Report Date Range endpoint

Added a new backend endpoint `GET /reports/gst-report-range` that accepts arbitrary `startDate` and `endDate` parameters, enabling daily, monthly, yearly, and custom range GST reports from the same API. Previously the backend only supported month-based GST reports via `GET /reports/gst-report?month=YYYY-MM`.

### Backend changes

| File | Change |
|------|--------|
| `server/src/controllers/reportController.ts` | Added `getGSTReportByRange` — new controller method that queries GST slabs, exempt items, invoices, and summary for any `startDate`/`endDate` range |
| `server/src/routes/reports.ts` | Added `GET /reports/gst-report-range` route (authenticated, owner/manager/admin) |

### API

```
GET /api/reports/gst-report-range?startDate=2026-04-01&endDate=2026-04-22
```

Response:
```json
{
  "success": true,
  "data": {
    "shop": { "name": "My Store", "gstin": "..." },
    "slabs": [
      { "tax_percent": 12, "invoice_count": 1, "taxable_value": 50, "total_tax": 6 }
    ],
    "exempt_value": 0,
    "invoices": [ /* ... */ ],
    "summary": {
      "total_invoices": 16,
      "total_taxable": 950,
      "total_tax": 6,
      "grand_total": 956
    },
    "range": { "startDate": "2026-04-01", "endDate": "2026-04-22" }
  }
}
```

---

## 📅 June 5, 2026 — Credit Trend Chart (Dashboard)

Replaced the hardcoded sample data in the Dashboard "Credit Given" line chart with real data from `customer_ledgers`.

### Backend changes

| File | Change |
|------|--------|
| `server/src/types/index.ts` | Added `CreditTrendItem` interface (`{ month: string, total: number }`) |
| `server/src/models/Customer.ts` | Added `getCreditTrend()` — queries `customer_ledgers` WHERE `type IN ('debit', 'sale')`, grouped by month |
| `server/src/controllers/customerController.ts` | Added `creditTrend` handler |
| `server/src/routes/customers.ts` | Added `GET /customers/credit-trend` route |

### Frontend changes

| File | Change |
|------|--------|
| `src/renderer/services/customerApi.ts` | Added `getCreditTrend()` API function |
| `src/pages/admin/Dashboard.tsx` | Removed hardcoded `creditChartData` array; fetches real data on load; hover tooltip now shows `₹amount` |

### API

```
GET /api/customers/credit-trend
```

Response:
```json
{
  "success": true,
  "data": [
    { "month": "2025-06", "total": 15000 },
    { "month": "2025-07", "total": 22000 }
  ]
}
```

# PRODUCT TEMPLATE MODULE
# 📅 june 7 2026

--------------PRODUCT TEMPLATE MODULE----------------------

1. Create Template

POST

http://localhost:3000/api/product-templates

Headers:

Authorization: Bearer <TOKEN>
Content-Type: application/json

Body:

{
  "name": "Tablet",
  "description": "Solid oral medicine",
  "category_uuid": "tablet-category-uuid",
  "icon": "tablet-portrait",

  "defaults_json": {
    "gst_percent": 12,
    "schedule_type": "NONE",
    "medicine_type": "Tablet",
    "prescription_required": false
  },

  "packaging_json": {
    "baseUnit": "Tablet",
    "templates": [
      {
        "name": "Strip",
        "contains": 15,
        "unit": "Tablet"
      },
      {
        "name": "Box",
        "contains": 20,
        "unit": "Strip"
      }
    ]
  }
}

Expected:

{
  "success": true,
  "data": {
    "template_uuid": "generated-uuid",
    "name": "Tablet"
  }
}
2. List Templates

GET

http://localhost:3000/api/product-templates

Headers:

Authorization: Bearer <TOKEN>

Expected:

{
  "success": true,
  "data": [
    {
      "template_uuid": "...",
      "name": "Tablet",
      "category_uuid": "tablet-category-uuid"
    }
  ]
}
3. Get Single Template

Copy the UUID from Step 1.

GET

http://localhost:3000/api/product-templates/<template_uuid>

Example:

http://localhost:3000/api/product-templates/2ab7d1f3-xxxx

Expected:

{
  "success": true,
  "data": {
    "template_uuid": "...",
    "name": "Tablet",
    "defaults_json": {
      "gst_percent": 12
    }
  }
}
4. Update Template

PUT

http://localhost:3000/api/product-templates/<template_uuid>

Headers:

Authorization: Bearer <TOKEN>
Content-Type: application/json

Body:

{
  "description": "Updated Tablet Template",
  "defaults_json": {
    "gst_percent": 5,
    "schedule_type": "H"
  }
}

Expected:

{
  "success": true,
  "data": {
    "description": "Updated Tablet Template"
  }
}
5. Delete Template

DELETE

http://localhost:3000/api/product-templates/<template_uuid>

Headers:

Authorization: Bearer <TOKEN>

Expected:

{
  "success": true,
  "message": "Deleted successfully"
}

--------------HOW TO USE IT-----------------------


Current Flow

Today your frontend does:

Hardcoded PRODUCT_TYPES
       ↓
User selects Tablet
       ↓
Product Form
       ↓
Unit Form
       ↓
Save Product
New Flow With Templates
Settings (Admin)

Create templates once.

Examples:

Tablet
Syrup
Injection
Device
Ayurvedic

Each template contains:

{
  "name": "Tablet",
  "category_uuid": "tablet-category",

  "defaults_json": {
    "gst_percent": 12,
    "schedule_type": "NONE"
  },

  "packaging_json": {
    "baseUnit": "Tablet",
    "templates": [
      {
        "name": "Strip",
        "contains": 15,
        "unit": "Tablet"
      }
    ]
  }
}

This is setup data.

Not product data.

Product Creation Screen

Instead of:

const PRODUCT_TYPES = [...]

You do:

GET /product-templates

Returns:

[
  {
    "template_uuid": "1",
    "name": "Tablet"
  },
  {
    "template_uuid": "2",
    "name": "Syrup"
  }
]
User Experience

User clicks:

+ Add Product

Show:

Choose Template

[ Tablet ]
[ Syrup ]
[ Injection ]
[ Device ]

Exactly like your current ProductType cards.

User selects Tablet

Frontend:

GET /product-templates/1

Returns:

{
  "name": "Tablet",
  "category_uuid": "tablet-category",

  "defaults_json": {
    "gst_percent": 12,
    "schedule_type": "NONE",
    "prescription_required": false
  },

  "packaging_json": {
    "baseUnit": "Tablet",
    "templates": [
      {
        "name": "Strip",
        "contains": 15,
        "unit": "Tablet"
      }
    ]
  }
}
Prefill Product Form

Instead of:

gst_percent = "0";
schedule_type = "NONE";

Use:

gst_percent = template.defaults_json.gst_percent;
schedule_type = template.defaults_json.schedule_type;

The user still enters:

Dolo 650
Manufacturer
Composition
Barcode
Price

Nothing changes.

Dynamic Attributes

Now use:

GET /category-attributes/:category_uuid

Example:

GET /category-attributes/tablet-category

Returns:

[
  {
    "name": "Strength"
  },
  {
    "name": "Dosage Form"
  }
]

Render those fields automatically.

Product Save

Still:

POST /products

No change.

---

## Backend Changelog

### 📅 2026-06-10 — Category `description` field support

**Files changed:**

| File | Change |
|------|--------|
| `server/src/database/migrations/001_initial.ts` | Added `description TEXT` column to `categories` table |
| `server/src/models/Category.ts` | Added `description` to `Category` and `CategoryCreateInput` interfaces; added `CategoryUpdateInput` interface; added `description` to INSERT; added `update()` static method |
| `server/src/controllers/categoryController.ts` | Added `description` to create payload; added `update` static method for PUT endpoint |
| `server/src/routes/categories.ts` | Added `PUT /:uuid` route for category update |
| `server/src/controllers/categoryAttributeController.ts` | Added `remove` static method for DELETE /category-attributes endpoint |
| `server/src/routes/categoryAttributes.ts` | Added `DELETE /` route for removing attribute from category |
| `src/renderer/services/categoryApi.ts` | Added `description` to `createCategory` payload; added `updateCategory()` and `removeAttributeFromCategory()` functions

---

Product Unit Step

After product creation:

{
  "product_uuid": "abc123"
}

Load template packaging:

{
  "baseUnit": "Tablet",
  "templates": [
    {
      "name": "Strip",
      "contains": 15,
      "unit": "Tablet"
    }
  ]
}

Prefill the Unit Form.

User can modify if needed.

Then:

POST /product-units

No change.
-------------------------------------------------------------------------------------------------------
Import Module API
Base URL
/api/import
1. Upload Excel

Uploads an Excel invoice and returns a preview of the parsed data.

Endpoint
POST /api/import/excel
Content-Type
multipart/form-data
Form Data
Field	Type	Required	Description
file	File (.xlsx)	✅	Supplier purchase invoice
Response
{
  "success": true,
  "data": {
    "supplier_uuid": null,
    "invoice_number": null,
    "invoice_date": null,
    "items": [
      {
        "manufacturer": null,
        "product_name": "Paracetamol 650mg Tablets",
        "hsn": "30049061",
        "batch": "BT9874",
        "expiry": "12/2027",
        "qty": 500,
        "free_qty": 0,
        "mrp": 15,
        "rate": 15,
        "gst": 12,
        "pack": null,
        "barcode": null,
        "sku": null
      }
    ]
  }
}
2. Commit Import

Commits the previewed invoice into inventory.

Endpoint
POST /api/auto-update
Content-Type
application/json
Request Body
{
  "supplier_uuid": "254c8bfa-cd86-4c5b-8a37-722cbd95618f",
  "invoice_number": "COMMIT01",
  "invoice_date": "17/07/2026",
  "items": [
    {
      "manufacturer": null,
      "product_name": "Paracetamol 650mg Tablets",
      "hsn": "30049061",
      "batch": "BT9874",
      "expiry": "12/2027",
      "qty": 500,
      "free_qty": 0,
      "mrp": 15,
      "rate": 15,
      "gst": 12,
      "pack": null,
      "barcode": null,
      "sku": null
    }
  ]
}
Success Response
{
  "success": true,
  "created": 8,
  "updated": 0,
  "errors": [],
  "message": "Successfully processed 8 items."
}
Partial Success
{
  "success": true,
  "partial": true,
  "created": 6,
  "updated": 1,
  "errors": [
    {
      "row": 5,
      "message": "Invalid expiry date"
    }
  ]
}