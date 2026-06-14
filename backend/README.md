# Nigehbaan Emergency Backend

Nigehbaan safety backend is an enterprise-grade, highly scalable, and secure RESTful API and real-time Socket.io server developed for the Nigehbaan women's safety and emergency response application.

---

## 🛠️ Technology Stack & Dependencies

- **Runtime Environment:** Node.js (v18+)
- **Application Framework:** Express.js
- **Database Engine:** MongoDB (via Mongoose)
- **Caching & Real-time Sync:** Redis (via ioredis)
- **WebSockets:** Socket.io (with `@socket.io/redis-adapter` for multi-node clustering)
- **Data Validation:** Zod
- **Authentication:** JSON Web Tokens (Access & Refresh tokens) & bcryptjs
- **Media Optimization:** Cloudinary (direct streaming uploads via multer memory buffers)
- **Geocoding:** Google Maps API (with fallback mock mode for offline testing)
- **Mailing Engine:** Nodemailer (with fallback console logging for local testing)

---

## 📐 Architecture & Layering

The application strictly implements a **layered architecture** to separate concerns:

```
Request ──> [ Routes ] ──> [ Middleware ] ──> [ Controllers ] ──> [ Services ] ──> [ Models / Redis ]
```

1. **Routes:** Defines API endpoints and registers middleware chains (e.g. rate-limiters, validators).
2. **Middleware:** Intercepts requests for authentication (JWT), authorization (RBAC), validation (Zod validation parser), rate-limiting (Redis checks), and global error trapping.
3. **Controllers:** Binds HTTP requests/responses, validates Zod schemas, and delegates business logic to services.
4. **Services:** Core business logic layer (e.g., location calculation, MongoDB records manipulation, Cloudinary file uploads, Redis session storage, and email dispatchers).
5. **Models/Data Access:** Mongoose models defining indexes (including `2dsphere` spatial indexing for geo-radius lookups).

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` into `.env` and fill in your values:

```bash
cp .env.example .env
```

| Key | Description | Default / Mock Value |
| :--- | :--- | :--- |
| `PORT` | Node server listening port | `5000` |
| `NODE_ENV` | Running node environment | `development` |
| `MONGODB_URI` | Connection string to MongoDB | `mongodb://localhost:27017/nigehbaan` |
| `REDIS_HOST` | Host address of Redis server | `127.0.0.1` |
| `REDIS_PORT` | Port of Redis server | `6379` |
| `JWT_ACCESS_SECRET` | JWT Access Token signing key | `nigehbaan_access_secret_129847129847` |
| `JWT_REFRESH_SECRET`| JWT Refresh Token signing key | `nigehbaan_refresh_secret_129847129847` |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary Cloud Identifier | `mock_cloudinary` (Activates mock fallback) |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform API Key | `mock_maps_key` (Activates mock fallback) |
| `AI_WEBHOOK_SECRET` | Header key for AI triggers (`X-AI-Model-Key`) | `ai_model_secret_nigehbaan_123` |
| `SMTP_HOST` | SMTP server host address | `smtp.mailtrap.io` |

---

## 🚀 Running the Services

### Prerequisites
Make sure you have **MongoDB** and **Redis** servers running locally (or configured correctly in your `.env`).

### Install Dependencies
```bash
npm install
```

### Start Development Server
Starts the server with nodemon auto-reloading:
```bash
npm run dev
```

### Run Production Server
```bash
npm start
```

---

## 📡 REST API Documentation

All REST routes are mounted under `/api/` prefix.

### 🔑 Authentication & Onboarding
- **`POST /api/auth/register`**: Onboard a user (requires `phone`, `cnic`, `email`, `password`, `role`). Includes password hashing.
- **`POST /api/auth/login`**: Authenticate credentials (returns user profile + JWT `accessToken` & `refreshToken`).
- **`POST /api/auth/refresh`**: Request a new `accessToken` using a valid `refreshToken`.
- **`POST /api/auth/logout`**: Terminate session (revokes refresh token from Redis storage).
- **`POST /api/auth/forgot-password`**: Request password reset link (delivers unique hashed token link via email).
- **`POST /api/auth/reset-password/:token`**: Perform password reset using token.

### 🚨 Incident Hub
- **`POST /api/incidents`**: Report a safety incident. Accepts multipart/form-data for media attachments (files uploaded directly to Cloudinary via memory streams), coordinates, and categories.
- **`GET /api/incidents/heatmap`**: Aggregates nearby incident densities and computes hazard threat scores based on category weightings using geospatial `$near` queries.
- **`GET /api/incidents`**: Lists historical incident logs (restricted to `SuperAdmin`, `B2G` dispatch, or `CorporateAdmin`).

### 📚 Law & Resource Center
- **`GET /api/laws`**: Fetch all legal articles and penal codes.
- **`GET /api/laws/category/:category`**: Fetch law resources matching a category.
- **`GET /api/laws/survival-instructions/:category`**: **Separate endpoint** to retrieve survival guides and danger mitigation steps for a threat category.
- **`POST /api/laws`**: Upsert legal documentation (restricted to `SuperAdmin`).
- **`DELETE /api/laws/category/:category`**: Delete a legal resource (restricted to `SuperAdmin`).

### 🤖 Local AI Model Webhook
- **`POST /api/webhook/ai-sos`**: Highly optimized endpoint for autonomous local AI models (screaming detectors, crash sensors). Auth verified via `X-AI-Model-Key` header. Automatically registers a high-priority SOS session in the database and caches it in Redis for emergency dispatch monitoring.

### 🛜 Mesh Sync (Offline Backup)
- **`POST /api/sync/mesh`**: Synchronizes buffered telemetry/pings and incidents cached on-device (synced via Bluetooth/Wi-Fi Direct during offline status) once internet connectivity is restored.

---

## 🔌 Socket.io Real-Time API (WebSockets)

Socket.io endpoints verify the JWT token during connection handshakes (`Authorization: Bearer <token>`).

### 🔴 Tracking & SOS Events
1. **`trigger_sos`**:
   - **Payload**: `{ coordinates: [lng, lat] }` (Coordinates optional)
   - **Description**: Initiates SOS tracking. Joins user to private tracking room `sos:room:<userId>`, notifies B2G dispatchers, and alerts online trusted contacts.
2. **`location_ping`**:
   - **Payload**: `{ coordinates: [lng, lat] }` (High-frequency GPS telemetry)
   - **Description**: Appends path to database SOS document, updates Redis cache, and broadcasts to room listeners.
3. **`resolve_sos`**:
   - **Description**: Ends the tracking room and updates DB session status to inactive.
4. **`subscribe_tracking`**:
   - **Payload**: `{ targetUserId: "<userId>" }`
   - **Description**: Guardians/police listen to active tracks. Includes permission filters (checks if guardian is in `trustedContacts` or user role is `B2G`/`SuperAdmin`). Returns the current active path from Redis.

### 🎙️ WebRTC & Audio Chat
1. **`audio_chunk`**:
   - **Payload**: `{ targetUserId: "<userId>", chunk: <audio_buffer> }`
   - **Description**: Stream low-latency audio blocks directly to emergency operators monitoring the room.
2. **`webrtc_signal`**:
   - **Payload**: `{ targetSocketId: "<socketId>", signal: <handshake_metadata> }`
   - **Description**: Establish direct peer-to-peer audio links between user and dispatch center.

---

## 🧪 Running the Verification Suite

A self-contained integration test script validates all backend services programmatically. Run this to test database operations, geospatial indexing, password hashing, and active SOS/Redis flows:

```bash
node verify.js
```
