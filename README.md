# MobileWala Auction Backend

Express/PostgreSQL backend for MobileWala.com reseller auctions. It supports reseller registration, JWT login, admin lot management, text-only inventory lots with variants, masked bid history, auction timelines, and reseller bidding.

## Stack

- Node.js 18+
- Express
- PostgreSQL
- JWT authentication
- `bcryptjs` password hashing
- Role-based access control: `admin`, `reseller`

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Create a PostgreSQL database and update `DATABASE_URL` in `.env`.

```bash
npm run db:schema
npm run db:seed
npm run dev
```

The API runs on `http://localhost:4000` by default.

Seed data includes:

- `admin@mobilewala.com`
- `karan@kkmobiles.example`
- `meera@metrophones.example`

The SQL seed uses a demo bcrypt hash. For production or local certainty, generate a hash and replace `password_hash` values:

```bash
node scripts/hash-password.js 'MobileWala@123'
```

## Auth

Send JWTs as:

```http
Authorization: Bearer <token>
```

## Endpoints

### Health

`GET /health`

```json
{
  "ok": true,
  "service": "mobilewala-auction-backend"
}
```

### Register Reseller

`POST /api/auth/register`

```json
{
  "email": "raj@phonemart.example",
  "password": "MobileWala@123",
  "displayName": "Raj Kumar",
  "companyName": "Phone Mart LLC",
  "phone": "+1-555-0112",
  "gstOrTaxId": "US-TAX-22019",
  "businessAddress": "91 Commerce Ave",
  "city": "Austin",
  "state": "TX",
  "country": "USA",
  "postalCode": "78701",
  "preferredBrands": ["Apple", "Samsung"],
  "monthlyVolumeEstimate": 300
}
```

Response:

```json
{
  "user": {
    "id": 4,
    "email": "raj@phonemart.example",
    "role": "reseller",
    "status": "active",
    "displayName": "Raj Kumar",
    "companyName": "Phone Mart LLC",
    "phone": "+1-555-0112"
  },
  "token": "jwt.token.here"
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "raj@phonemart.example",
  "password": "MobileWala@123"
}
```

### Current User

`GET /api/auth/me`

Returns the authenticated user and reseller profile fields when available.

### Active Lots

`GET /api/lots`

Returns only active lots where `starts_at <= now < ends_at`.

```json
{
  "lots": [
    {
      "id": 1,
      "title": "IPHONE 14 PRO SERIES HYLA A+ & DNA",
      "series": "iPhone 14 Pro Series",
      "gradeLabel": "HYLA A+ & DNA",
      "status": "active",
      "startingBid": 125000,
      "bidIncrement": 500,
      "currency": "USD",
      "totalQuantity": 495,
      "highestBid": 127000,
      "bidCount": 2,
      "listingText": "IPHONE 14 PRO SERIES HYLA A+ & DNA\n- 🟠 128GB GOLD A+ - 213 PCS\n- ⚪ 128GB SILVER A+ - 94 PCS"
    }
  ]
}
```

### Lot Detail With Masked Bid History

`GET /api/lots/:id`

Bidder identities are masked as first letter, two asterisks, last letter.

```json
{
  "lot": {
    "id": 1,
    "title": "IPHONE 14 PRO SERIES HYLA A+ & DNA",
    "bidHistory": [
      {
        "id": 2,
        "amount": 127000,
        "bidder": "M**H",
        "createdAt": "2026-05-17T10:00:00.000Z"
      }
    ]
  }
}
```

### Place Bid

`POST /api/lots/:lotId/bids`

Role: `reseller`

```json
{
  "amount": 128000,
  "note": "Ready to close if awarded"
}
```

Rules:

- Lot must be `active`
- Current time must be inside the auction window
- First bid must be at least `startingBid`
- Later bids must be at least `highestBid + bidIncrement`

### Lot Bid History

`GET /api/lots/:lotId/bids`

Returns masked bid history sorted by highest amount first.

### Reseller Profile And Bidding History

`GET /api/reseller/profile`

Role: `reseller`

### Admin: List Lots

`GET /api/lots/admin/all`

Role: `admin`

Optional query:

```http
GET /api/lots/admin/all?status=active
```

### Admin: Create Lot

`POST /api/lots/admin`

Role: `admin`

```json
{
  "title": "IPHONE 14 PRO SERIES HYLA A+ & DNA",
  "series": "iPhone 14 Pro Series",
  "gradeLabel": "HYLA A+ & DNA",
  "status": "active",
  "description": "Text-only wholesale lot.",
  "startingBid": 125000,
  "bidIncrement": 500,
  "currency": "USD",
  "startsAt": "2026-05-17T09:00:00.000Z",
  "endsAt": "2026-05-22T09:00:00.000Z",
  "variants": [
    {
      "storageCapacity": "128GB",
      "colorName": "Gold",
      "colorIndicator": "🟠",
      "quantity": 213,
      "gradeLabel": "A+",
      "sortOrder": 1
    },
    {
      "storageCapacity": "128GB",
      "colorName": "Silver",
      "colorIndicator": "⚪",
      "quantity": 94,
      "gradeLabel": "A+",
      "sortOrder": 2
    }
  ]
}
```

### Admin: Update Lot

`PATCH /api/lots/admin/:id`

Role: `admin`

Send any editable lot fields. If `variants` is present, the variant list is replaced.

### Admin: Update Lot Status

`PATCH /api/lots/admin/:id/status`

Role: `admin`

```json
{
  "status": "closed"
}
```

Allowed statuses: `draft`, `scheduled`, `active`, `closed`, `cancelled`.

### Admin: List Resellers

`GET /api/admin/resellers`

Role: `admin`

Returns reseller account details plus bid counts and total bid value.

## Database Tables

- `users`: admins and resellers
- `reseller_profiles`: company details and expected volume
- `lots`: auction lot header, status, timeline, starting bid
- `lot_variants`: storage/color/quantity/grade rows under each lot
- `bids`: reseller bids
- `auction_events`: audit trail for lot changes and bid activity

## Color Indicators

The API stores indicators as text so admins can use any display token. Seed examples:

- `🟠` Gold
- `⚪` Silver
- `🟢` Green
- `🌑` Phantom Black
