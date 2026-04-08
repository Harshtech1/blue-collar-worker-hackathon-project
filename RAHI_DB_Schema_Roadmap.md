# RAHI Platform: Database Schema & Roadmap

## 1. Overview
The RAHI platform uses MongoDB (via native Node.js driver) for high performance and flexibility. Since we are using the native driver rather than Mongoose, schema enforcement will rely on structural validation in our controller/model layers and optionally MongoDB native JSON schema validation.

This document outlines the ideal schema structures, relationships, and indexing strategies required to scale the application efficiently while supporting Customer, Worker, and Thekedar (Contractor) operations.

---

## 2. Collections & Schema Definitions

### 1. `users`
Centralized authentication and identification across all roles.
- `_id`: ObjectId
- `full_name`: String (Required)
- `email`: String (Optional/Unique - required for web login)
- `phone`: String (Unique - primary for blue-collar authentication)
- `password`: String (Hashed)
- `role`: Enum `["customer", "worker", "thekedar", "admin"]` (Default: "customer")
- `isVerified`: Boolean (Default: false)
- `profilePicture`: String (URL)
- `socials`: Object `{ twitter: String, linkedin: String }` (Optional client access handles)
- `createdAt` / `updatedAt`: Date

### 2. `worker_profiles`
Detailed information specifically for users with the "worker" role.
- `_id`: ObjectId
- `user_id`: ObjectId (Ref -> `users._id`, Unique)
- `serviceCategories`: Array of ObjectIds (Ref -> `service_categories._id`)
- `experience_years`: Number
- `base_price`: Number (Hourly/Daily base rate)
- `bio`: String
- `aadhaar_url`: String (ID verification)
- `status`: Enum `["online", "offline", "busy", "suspended"]`
- `isAvailable`: Boolean (Computed or toggled for booking availability)
- `location`: GeoJSON Point `{ type: "Point", coordinates: [lng, lat] }` (For spatial queries/live tracking)
- `address`: String
- `completed_jobs_count`: Number (Default: 0)
- `total_earnings`: Number (Default: 0)
- `rating`: Number (Average review rating, Default: 0)

### 3. `service_categories`
Master list of services provided on the platform.
- `_id`: ObjectId
- `name`: String (e.g., "Daily Labor")
- `name_hi`: String (e.g., "दिहाड़ी मजदूर")
- `description`: String
- `icon`: String (Identifier for frontend icons, e.g., "hard-hat")
- `color`: String (Hex code for UI styling)
- `base_commission_rate`: Number (e.g., 0.10 for 10% platform fee)
- `is_active`: Boolean (Default: true)
- `display_order`: Number

### 4. `bookings`
Core operational entity handling job states from request to completion.
- `_id`: ObjectId
- `customer_user_id`: String / ObjectId (Ref -> `users._id`)
- `worker_user_id`: String / ObjectId (Ref -> `users._id` - Nullable until accepted)
- `service_categoryId`: ObjectId (Ref -> `service_categories._id`)
- `serviceName`: String (Snapshot at time of booking)
- `amount`: Number (Agreed price)
- `status`: Enum `["pending", "matched", "accepted", "arriving", "otp_verify", "in_progress", "completed", "cancelled"]`
- `bookingType`: Enum `["immediate", "scheduled"]`
- `scheduled_at`: Date
- `address`: String
- `customer_location`: GeoJSON Point
- `otp_start`: String (4-digit code)
- `otp_finish`: String (4-digit code)
- `otpStartVerified`: Boolean (Default: false)
- `otpFinishVerified`: Boolean (Default: false)
- `workStartedAt`: Date
- `workCompletedAt`: Date
- `cancelReason`: String (e.g., "declined_by_worker", "customer_cancelled")
- `paymentStatus`: Enum `["pending", "paid", "failed", "refunded"]`
- `createdAt` / `updatedAt`: Date

### 5. `payments`
Financial ledger ensuring exact tracking of platform fees and worker earnings.
- `_id`: ObjectId
- `booking_id`: ObjectId (Ref -> `bookings._id`)
- `customer_id`: ObjectId (Ref -> `users._id`)
- `worker_id`: ObjectId (Ref -> `users._id`)
- `total_amount`: Number
- `platform_fee`: Number
- `worker_earning`: Number
- `status`: Enum `["pending", "success", "failed", "refunded"]`
- `method`: String (e.g., "cash_to_worker", "upi", "card")
- `transaction_id`: String (Gateway reference)
- `createdAt`: Date

### 6. `notifications`
In-app and push notification alerts.
- `_id`: ObjectId
- `userId`: String / ObjectId (Ref -> `users._id`)
- `title`: String
- `message`: String
- `type`: Enum `["booking", "system", "payment", "promotion"]`
- `read`: Boolean (Default: false)
- `link`: String (Optional URL routing)
- `createdAt`: Date

### 7. `reviews` (New Collection)
To track quality and calculate worker ratings.
- `_id`: ObjectId
- `booking_id`: ObjectId (Ref -> `bookings._id`)
- `worker_id`: ObjectId (Ref -> `users._id`)
- `customer_id`: ObjectId (Ref -> `users._id`)
- `rating`: Number (1 to 5)
- `comment`: String
- `createdAt`: Date

---

## 3. Recommended Indexing Strategy

Implementing the following indexes ensures queries bypass full-collection scans ($COLLSCAN) and execute extremely fast:

### Users
- `db.users.createIndex({ "email": 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } })`
- `db.users.createIndex({ "phone": 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } })`

### Worker Profiles
- `db.worker_profiles.createIndex({ "user_id": 1 }, { unique: true })`
- `db.worker_profiles.createIndex({ "serviceCategories": 1 })`
- `db.worker_profiles.createIndex({ "location": "2dsphere" })` *(Required for GeoSpatial worker matching)*
- `db.worker_profiles.createIndex({ "status": 1, "isAvailable": 1 })` *(For quick online/available worker fetching)*

### Bookings
- `db.bookings.createIndex({ "customer_user_id": 1, "createdAt": -1 })` *(Customer history)*
- `db.bookings.createIndex({ "worker_user_id": 1, "status": 1, "createdAt": -1 })` *(Worker dashboard & history)*
- `db.bookings.createIndex({ "status": 1, "createdAt": -1 })` *(For cronjobs: finding stale pending bookings)*

### Notifications
- `db.notifications.createIndex({ "userId": 1, "read": 1, "createdAt": -1 })` *(Fetch unread accurately)*

---

## 4. Execution Roadmap

**Phase 1: Standardization (Current Iteration)**
1. Standardize models in `Backend/src/models/` to expect and validate these structures.
2. Build DB indexes immediately on live MongoDB via script or console commands to eliminate application lag.

**Phase 2: Entity Relations & Features Integrations**
1. Migrate hardcoded worker matching to use Geospatial `2dsphere` distance queries if available, leveraging `worker_profiles.location`.
2. Ensure social endpoints (Twitter, LinkedIn handles mapping) are accessible in User/Worker profile CRUD routes.
3. Build the backend schema functions that auto-calculate `worker_earning` vs `platform_fee` into the `payments` collection reliably.

**Phase 3: Production Validation Enforcements**
1. Write MongoDB Validation Schemas using `$jsonSchema` inside `db.createCollection(name, { validator: {$jsonSchema: ...} })` to enforce data types at the database level.
