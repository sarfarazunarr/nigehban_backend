# Nigehbaan Mobile App Integration Guide (Updated)

This document updates the Nigehbaan integration manual to reflect new safety resources management, guardian-ward linkages, locations, alerts, and disabled route safety ratings.

---

## 1. Safety Resources & Helplines API (`/api/emergency-contacts`)

Global emergency helplines can be managed by admins and fetched by standard clients.

### 1.1 Fetch All Emergency Helplines
- **Method**: `GET`
- **Path**: `/api/emergency-contacts`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6d9b05c46426a1b2c3d4e5f0",
      "name": "Police Emergency Helpline",
      "phone": "15",
      "description": "Nationwide dispatch, regional patrol dispatchers",
      "createdAt": "2026-06-15T09:00:00.000Z",
      "updatedAt": "2026-06-15T09:00:00.000Z"
    }
  ]
}
```

### 1.2 Add or Update Emergency Helpline (SuperAdmin Only)
- **Method**: `POST`
- **Path**: `/api/emergency-contacts`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
```json
{
  "id": "6d9b05c46426a1b2c3d4e5f0", // Optional: Provide to edit existing
  "name": "Edhi Ambulance Service",
  "phone": "115",
  "description": "Emergency ambulance dispatch"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Emergency contact updated successfully",
  "data": {
    "_id": "6d9b05c46426a1b2c3d4e5f0",
    "name": "Edhi Ambulance Service",
    "phone": "115",
    "description": "Emergency ambulance dispatch"
  }
}
```

### 1.3 Delete Emergency Helpline (SuperAdmin Only)
- **Method**: `DELETE`
- **Path**: `/api/emergency-contacts/:id`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Emergency contact deleted successfully."
}
```

---

## 2. Profile Updates & User Details (`/api/profile`)

We have added `name` and `address` fields to user profile and introduced a detailed profile viewer.

### 2.1 Update Profile Name and Address
- **Method**: `PATCH`
- **Path**: `/api/profile`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
```json
{
  "name": "Ayesha Khan",
  "address": "House 45, Sector F-11/2, Islamabad"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "648c08ef...",
    "phone": "+923001234567",
    "cnic": "4210112345678",
    "email": "user@nigehbaan.pk",
    "role": "User",
    "name": "Ayesha Khan",
    "address": "House 45, Sector F-11/2, Islamabad",
    "trustedContacts": [],
    "lastLocation": {
      "type": "Point",
      "coordinates": [0, 0]
    }
  }
}
```

### 2.2 Link Guardian by User ID, Phone, Email, or CNIC
- **Method**: `POST`
- **Path**: `/api/profile/contacts`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
```json
{
  "contactInfo": "648c09ff..." // Accepts MongoDB User ID (ObjectId) in addition to phone, email, or CNIC
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Trusted contact added successfully",
  "data": { ... }
}
```

### 2.3 Fetch Complete User & Guardian details (SuperAdmin / B2G Only)
- **Method**: `GET`
- **Path**: `/api/profile/users/:userId`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "_id": "648c08ef...",
    "phone": "+923001234567",
    "cnic": "4210112345678",
    "email": "user@nigehbaan.pk",
    "role": "User",
    "name": "Ayesha Khan",
    "address": "House 45, Sector F-11/2, Islamabad",
    "trustedContacts": [
      {
        "_id": "648c09ff...",
        "phone": "+923009876543",
        "cnic": "4210198765432",
        "email": "guardian@nigehbaan.pk",
        "role": "Guardian",
        "name": "Kamran Khan",
        "address": "Sector G-10, Islamabad"
      }
    ],
    "lastLocation": {
      "type": "Point",
      "coordinates": [73.0479, 33.6844]
    }
  }
}
```

---

## 3. Guardian Safety API (`/api/profile/guardian`)

Guardians can fetch active safety telemetry, trigger alerts, and request locations of users who have added them as trusted contacts.

### 3.1 Get Ward Active Alerts
- **Method**: `GET`
- **Path**: `/api/profile/guardian/alerts`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "648c0aaa...",
      "user": {
        "_id": "648c08ef...",
        "phone": "+923001234567",
        "cnic": "4210112345678",
        "email": "user@nigehbaan.pk",
        "name": "Ayesha Khan",
        "address": "House 45, Sector F-11/2, Islamabad",
        "lastLocation": {
          "type": "Point",
          "coordinates": [73.0479, 33.6844]
        }
      },
      "active": true,
      "startTime": "2026-06-15T09:10:00.000Z",
      "coordinates": [ ... ]
    }
  ]
}
```

### 3.2 Get Wards Locations
- **Method**: `GET`
- **Path**: `/api/profile/guardian/locations`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "648c08ef...",
      "phone": "+923001234567",
      "cnic": "4210112345678",
      "email": "user@nigehbaan.pk",
      "role": "User",
      "name": "Ayesha Khan",
      "address": "House 45, Sector F-11/2, Islamabad",
      "lastLocation": {
        "type": "Point",
        "coordinates": [73.0479, 33.6844]
      }
    }
  ]
}
```

### 3.3 Trigger SOS Alert on behalf of Ward
- **Method**: `POST`
- **Path**: `/api/profile/guardian/trigger-alert/:userId`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "SOS session successfully triggered on behalf of user.",
  "session": {
    "_id": "648c0aaa...",
    "active": true,
    "startTime": "2026-06-15T09:12:00.000Z"
  }
}
```

### 3.4 Request Ward Current Location
- **Method**: `POST`
- **Path**: `/api/profile/guardian/request-location/:userId`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Location request sent successfully.",
  "lastLocation": {
    "type": "Point",
    "coordinates": [73.0479, 33.6844]
  }
}
```

---

## 4. Socket.io Live Actions (WebSocket)

### 4.1 Request Ward Live Location
- **Client Emits Event**: `guardian_request_location`
- **Payload**:
```json
{
  "targetUserId": "648c08ef..."
}
```
- **Acknowledge Callback Return**:
```json
{
  "success": true,
  "lastLocation": {
    "type": "Point",
    "coordinates": [73.0479, 33.6844]
  }
}
```
- **Resulting Server Event**: Emits a `location_request_received` to target user room `user:notifications:<targetUserId>` so target user device can ping back fresh coordinates.
  - **Payload received by Target User**:
  ```json
  {
    "requestedBy": {
      "_id": "648c09ff...",
      "phone": "+923009876543",
      "name": "Kamran Khan"
    }
  }
  ```

### 4.2 Trigger SOS Alert on behalf of Ward
- **Client Emits Event**: `guardian_trigger_alert`
- **Payload**:
```json
{
  "targetUserId": "648c08ef..."
}
```
- **Acknowledge Callback Return**:
```json
{
  "success": true,
  "sessionId": "648c0aaa..."
}
```
- **Resulting Server Event**: Emits `sos_dispatch_alert` to B2G dispatch room and `sos_alert` to all user guardians.

---

## 5. Google Maps Routing Rating Rating (Disabled)

As requested, safety ratings enlisting on route safety are disabled. Bounding box incident analysis has been bypassed.

### 5.1 Route Check safety rating Response
- **Method**: `GET`
- **Path**: `/api/routes/safety`
- **Response Format (Bypassed)**:
```json
{
  "success": true,
  "data": [
    {
      "routeIndex": 0,
      "summary": "Srinagar Highway",
      "distance": "6.2 km",
      "duration": "12 mins",
      "safetyStatus": "unrated",
      "safetyAssessment": "Route safety rating is temporarily disabled.",
      "nearbyIncidentsCount": 0,
      "nearbyIncidents": [],
      "steps": [ ... ]
    }
  ]
}
```
