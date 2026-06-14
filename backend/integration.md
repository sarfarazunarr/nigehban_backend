# Nigehbaan Mobile App Integration Guide

Welcome to the Nigehbaan Backend Integration Guide. This document details all available REST APIs and WebSocket communication interfaces, including payloads, query strings, headers, and response examples, to help mobile developers (Flutter/React Native/iOS/Android) integrate the safety application perfectly.

---

## 1. Core Integration Concepts

### Base URL
- **REST Endpoints**: `http://<server-ip>:5000/api`
- **Socket.io Connection**: `http://<server-ip>:5000`

### Authentication Headers
Most endpoints require a JSON Web Token (JWT) in the headers:
```http
Authorization: Bearer <accessToken>
```

### Roles Structure
- `User`: Standard female user reporting incidents or triggering SOS.
- `Guardian`: Family member or trusted contact receiving alerts.
- `B2G`: Emergency responders, police command dispatchers, or operators.
- `SuperAdmin`: System managers managing laws and rules.

---

## 2. Authentication API (`/api/auth`)

### 2.1 User Registration
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Body (JSON)**:
```json
{
  "phone": "+923001234567",
  "cnic": "4210112345678",
  "email": "user@nigehbaan.pk",
  "password": "SecurePassword123",
  "role": "User"
}
```
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "user": {
    "_id": "648c08ef...",
    "phone": "+923001234567",
    "cnic": "4210112345678",
    "email": "user@nigehbaan.pk",
    "role": "User",
    "trustedContacts": [],
    "trackingEnabled": false,
    "subscriptionTier": "Free",
    "createdAt": "2026-06-14T07:00:00.000Z",
    "updatedAt": "2026-06-14T07:00:00.000Z"
  }
}
```

### 2.2 User Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body (JSON)**:
```json
{
  "phoneOrEmail": "+923001234567",
  "password": "SecurePassword123"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "user": {
    "_id": "648c08ef...",
    "phone": "+923001234567",
    "cnic": "4210112345678",
    "email": "user@nigehbaan.pk",
    "role": "User"
  }
}
```

### 2.3 Token Refresh
- **Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Body (JSON)**:
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi..."
}
```

### 2.4 Logout
- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Logout successful. Token revoked."
}
```

---

## 3. Profile Management API (`/api/profile`)
All routes require `Authorization` headers.

### 3.1 Fetch Profile Details
- **Method**: `GET`
- **Path**: `/api/profile`
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
    "trustedContacts": [
      {
        "_id": "648c09ff...",
        "phone": "+923009876543",
        "cnic": "4210198765432",
        "email": "guardian@nigehbaan.pk",
        "role": "Guardian"
      }
    ],
    "trackingEnabled": false
  }
}
```

### 3.2 Add Family Member / Guardian
- **Method**: `POST`
- **Path**: `/api/profile/contacts`
- **Body (JSON)**:
```json
{
  "contactInfo": "+923009876543" 
}
```
> Note: `contactInfo` can accept the phone number, email, or CNIC of the guardian to link.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Trusted contact added successfully",
  "data": {
    "_id": "648c08ef...",
    "trustedContacts": [
      {
        "_id": "648c09ff...",
        "phone": "+923009876543",
        "email": "guardian@nigehbaan.pk"
      }
    ]
  }
}
```

### 3.3 Remove Family Member / Guardian
- **Method**: `DELETE`
- **Path**: `/api/profile/contacts/:contactId`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Trusted contact removed successfully",
  "data": {
    "_id": "648c08ef...",
    "trustedContacts": []
  }
}
```

---

## 4. SOS Trigger REST Backup (`/api/sos`)
*Standard SOS telemetry should use WebSockets (see Section 9), but these REST endpoints serve as fallback mechanisms.*

### 4.1 Initiate SOS Session
- **Method**: `POST`
- **Path**: `/api/sos/start`
- **Body (JSON)**:
```json
{
  "longitude": 73.0479,
  "latitude": 33.6844
}
```
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "SOS session initiated",
  "session": {
    "_id": "648c0aaa...",
    "user": "648c08ef...",
    "active": true,
    "startTime": "2026-06-14T07:10:00.000Z",
    "coordinates": [
      {
        "location": {
          "type": "Point",
          "coordinates": [73.0479, 33.6844]
        },
        "timestamp": "2026-06-14T07:10:00.000Z"
      }
    ]
  }
}
```

### 4.2 Location Ping during active SOS
- **Method**: `POST`
- **Path**: `/api/sos/ping`
- **Body (JSON)**:
```json
{
  "longitude": 73.0585,
  "latitude": 33.6950
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Location updated",
  "session": { ... }
}
```

### 4.3 Close SOS Session
- **Method**: `POST`
- **Path**: `/api/sos/close`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "SOS session closed successfully",
  "session": {
    "_id": "648c0aaa...",
    "active": false,
    "endTime": "2026-06-14T07:15:00.000Z"
  }
}
```

---

## 5. Laws, Rules & Survival Resources (`/api/laws`)

### 5.1 Fetch All Laws
- **Method**: `GET`
- **Path**: `/api/laws`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "category": "harassment",
      "title": "Harassment Protection Law Section 509",
      "legalDescription": "Pakistan Penal code...",
      "survivalInstructions": [
        "Shout to gather public support.",
        "Document proof if safe to do so."
      ],
      "precautions": [
        "Avoid poorly lit pedestrian routes."
      ]
    }
  ]
}
```

### 5.2 Fetch Survival Instructions (Specific Category)
- **Method**: `GET`
- **Path**: `/api/laws/survival-instructions/:category`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "category": "harassment",
    "title": "Harassment Protection Law Section 509",
    "survivalInstructions": [
      "Shout to gather public support.",
      "Document proof if safe to do so."
    ]
  }
}
```

### 5.3 Fetch Safety Precautions (Specific Category)
- **Method**: `GET`
- **Path**: `/api/laws/precautions/:category`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "category": "harassment",
    "title": "Harassment Protection Law Section 509",
    "precautions": [
      "Avoid poorly lit pedestrian routes."
    ]
  }
}
```

---

## 6. Incident Hub / Complaints API (`/api/incidents`)

### 6.1 Register Complaint (With Multi-Media Attachment)
- **Method**: `POST`
- **Path**: `/api/incidents`
- **Headers**: `Content-Type: multipart/form-data`
- **Multipart Body Fields**:
  - `category`: Must be one of `['harassment', 'stalking', 'domestic_violence', 'physical_assault', 'kidnapping', 'other']`
  - `description`: String details of complaint.
  - `longitude`: Number decimal.
  - `latitude`: Number decimal.
  - `media`: File payload array (Attach image/audio files, max 5).
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Incident reported successfully",
  "incident": {
    "_id": "648c0ccc...",
    "reporter": "648c08ef...",
    "category": "harassment",
    "location": {
      "type": "Point",
      "coordinates": [73.0479, 33.6844]
    },
    "mediaUrls": [
      "https://res.cloudinary.com/..."
    ],
    "description": "Stalking event reported near market. [Verified Location Address: Srinagar Highway, F-7 Islamabad]",
    "status": "pending",
    "teamReply": "",
    "action": "",
    "timestamp": "2026-06-14T07:20:00.000Z"
  }
}
```

### 6.2 View My Reported Complaints
- **Method**: `GET`
- **Path**: `/api/incidents/my`
- **Query Params**: `page` (default 1), `limit` (default 20)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "incidents": [
    {
      "_id": "648c0ccc...",
      "category": "harassment",
      "description": "Incident details...",
      "status": "in-progress",
      "teamReply": "Police dispatcher unit 4 assigned.",
      "action": "Unit patrolling in-route.",
      "timestamp": "2026-06-14T07:20:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 6.3 View Specific Complaint Details
- **Method**: `GET`
- **Path**: `/api/incidents/:id`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "_id": "648c0ccc...",
    "reporter": {
      "_id": "648c08ef...",
      "phone": "+923001234567",
      "cnic": "4210112345678"
    },
    "category": "harassment",
    "mediaUrls": ["https://..."],
    "description": "Details...",
    "status": "in-progress",
    "teamReply": "Unit 4 dispatched.",
    "action": "Assigned responder.",
    "timestamp": "2026-06-14T07:20:00.000Z"
  }
}
```

### 6.4 Update Complaint Status & Actions (Admin/B2G Dispatcher Only)
- **Method**: `PATCH`
- **Path**: `/api/incidents/:id`
- **Body (JSON)**:
```json
{
  "status": "in-progress", 
  "teamReply": "First responder dispatch unit dispatched to destination.",
  "action": "Dispatched emergency force unit #18."
}
```
> Note: `status` must be one of `['pending', 'in-progress', 'resolved', 'dismissed']`.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Complaint updated successfully",
  "data": {
    "_id": "648c0ccc...",
    "status": "in-progress",
    "teamReply": "First responder dispatch unit dispatched to destination.",
    "action": "Dispatched emergency force unit #18."
  }
}
```

---

## 7. Google Maps Route Safety Analysis (`/api/routes`)

### 7.1 Search and Rate Safety of Routes
- **Method**: `GET`
- **Path**: `/api/routes/safety`
- **Query Params**:
  - `origin`: Text (e.g. `G-11 Islamabad` or lat,lng `33.684,73.047`)
  - `destination`: Text (e.g. `Blue Area Islamabad` or lat,lng `33.718,73.068`)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "routeIndex": 0,
      "summary": "Srinagar Highway",
      "distance": "6.2 km",
      "duration": "12 mins",
      "safetyStatus": "safe",
      "safetyAssessment": "This route is verified safe with no reported incidents nearby.",
      "nearbyIncidentsCount": 0,
      "nearbyIncidents": [],
      "steps": [
        {
          "start_location": { "lng": 73.0479, "lat": 33.6844 },
          "end_location": { "lng": 73.0585, "lat": 33.6950 },
          "html_instructions": "Head northeast on Srinagar Highway"
        }
      ]
    },
    {
      "routeIndex": 1,
      "summary": "Alternative Route (via Jinnah Ave)",
      "distance": "7.8 km",
      "duration": "18 mins",
      "safetyStatus": "unsafe",
      "safetyAssessment": "WARNING: This route is considered unsafe. There are 2 nearby threat incidents.",
      "nearbyIncidentsCount": 2,
      "nearbyIncidents": [
        {
          "id": "648c0ccc...",
          "category": "harassment",
          "coordinates": [73.0420, 33.6700],
          "description": "Details...",
          "status": "pending",
          "distanceMeters": 210
        }
      ],
      "steps": [ ... ]
    }
  ]
}
```

---

## 8. Community Help Alerts & Peer Chat (`/api/community`)
All routes require `Authorization: Bearer <accessToken>` headers.

### 8.1 Trigger Community Help Request Alert
- **Method**: `POST`
- **Path**: `/api/community/alert`
- **Body (JSON)**:
```json
{
  "longitude": 73.0479,
  "latitude": 33.6844,
  "message": "My car wheel broke down on Kashmiri road. Needs manual help."
}
```
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Community help alert broadcasted successfully",
  "alert": {
    "_id": "6a2e585c464261dcb1e9f259",
    "seeker": "648c08ef...",
    "location": {
      "type": "Point",
      "coordinates": [73.0479, 33.6844]
    },
    "message": "My car wheel broke down on Kashmiri road. Needs manual help.",
    "active": true,
    "createdAt": "2026-06-14T07:20:00.000Z",
    "updatedAt": "2026-06-14T07:20:00.000Z"
  }
}
```

### 8.2 Close Active Help Request Alert
- **Method**: `POST`
- **Path**: `/api/community/alert/:alertId/close`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Help request alert closed successfully",
  "alert": {
    "_id": "6a2e585c464261dcb1e9f259",
    "active": false
  }
}
```

### 8.3 Get Active Nearby Help Request Alerts
- **Method**: `GET`
- **Path**: `/api/community/alerts/nearby`
- **Query Params**:
  - `longitude`: Number (geospatial center)
  - `latitude`: Number
  - `radius`: Number (search distance in meters, default 2000)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6a2e585c464261dcb1e9f259",
      "seeker": {
        "_id": "648c08ef...",
        "phone": "+923001234567",
        "role": "User"
      },
      "location": {
        "type": "Point",
        "coordinates": [73.0479, 33.6844]
      },
      "message": "My car wheel broke down on Kashmiri road. Needs manual help.",
      "active": true
    }
  ]
}
```

### 8.4 Respond to Nearby Help Request (Creates Chat Channel)
- **Method**: `POST`
- **Path**: `/api/community/alert/:alertId/respond`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Successfully responded to alert. Chat channel opened.",
  "chat": {
    "_id": "6a2e585c464261dcb1e9f25a",
    "alert": "6a2e585c464261dcb1e9f259",
    "seeker": "648c08ef...",
    "helper": "648c09ff...",
    "messages": []
  }
}
```

### 8.5 Get Active Help Chat Channels List
- **Method**: `GET`
- **Path**: `/api/community/chats`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6a2e585c464261dcb1e9f25a",
      "alert": {
        "_id": "6a2e585c464261dcb1e9f259",
        "message": "My car wheel broke down...",
        "active": true
      },
      "seeker": {
        "_id": "648c08ef...",
        "phone": "+923001234567"
      },
      "helper": {
        "_id": "648c09ff...",
        "phone": "+923009876543"
      },
      "updatedAt": "2026-06-14T07:22:00.000Z"
    }
  ]
}
```

### 8.6 Fetch Specific Chat Details and Message Log
- **Method**: `GET`
- **Path**: `/api/community/chats/:chatId`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "_id": "6a2e585c464261dcb1e9f25a",
    "alert": {
      "message": "My car wheel broke down..."
    },
    "seeker": {
      "phone": "+923001234567"
    },
    "helper": {
      "phone": "+923009876543"
    },
    "messages": [
      {
        "sender": "648c09ff...",
        "content": "I have a car jack, heading your way.",
        "timestamp": "2026-06-14T07:22:00.000Z"
      }
    ]
  }
}
```

### 8.7 Send Chat Message (REST Fallback)
- **Method**: `POST`
- **Path**: `/api/community/chats/:chatId/message`
- **Body (JSON)**:
```json
{
  "content": "I have arrived at Kashmiri road."
}
```
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "sender": "648c09ff...",
    "content": "I have arrived at Kashmiri road.",
    "timestamp": "2026-06-14T07:23:00.000Z"
  }
}
```

---

## 9. Sockets & Real-Time Communications (Socket.io)

### Connection
Attach JWT in handshake auth or headers:
```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "eyJhbGciOi..." // your JWT accessToken
  }
});
```

### Auto-Joined Channels (Rooms)
1. **Notifications Channel**: `user:notifications:<userId>` - Receives custom direct alerts.
2. **Role Channel**: `role:<userRole>` - (e.g. `role:B2G` receives dispatch alerts).

---

### 9.1 SOS Operations

#### client -> server: Start Live SOS Track
- **Event**: `trigger_sos`
- **Payload**:
```json
{
  "coordinates": [73.0479, 33.6844]
}
```
- **Callback Return**: `{ success: true, sessionId: "648c0aaa..." }`

#### client -> server: GPS Coordinates telemetry ping (High Frequency)
- **Event**: `location_ping`
- **Payload**:
```json
{
  "coordinates": [73.0485, 33.6852]
}
```
- **Callback Return**: `{ success: true }`

#### client -> server: End SOS Session
- **Event**: `resolve_sos`
- **Payload**: `null`
- **Callback Return**: `{ success: true }`

#### server -> client: Direct alert to Guardian notification rooms
- **Event**: `sos_alert`
- **Payload**:
```json
{
  "reporterId": "648c08ef...",
  "reporterPhone": "+923001234567",
  "coordinates": [73.0479, 33.6844],
  "sessionId": "648c0aaa..."
}
```

---

### 9.2 Realtime WebRTC and Audio Streaming

#### client -> server: Relay Raw Audio Stream
Pipes raw audio chunks from reporting victim's microphone directly to listening operators/guardians.
- **Event**: `audio_chunk`
- **Payload**:
```json
{
  "targetUserId": "648c08ef...",
  "chunk": "base64EncodedAudioDataString"
}
```

#### server -> client: Listen to Audio Stream
- **Event**: `audio_chunk_receive`
- **Payload**: `{ userId, chunk, timestamp }`

#### client -> server: Relay WebRTC Signaling
Pipes SDP offers, answers, and ICE candidate negotiation objects for peer-to-peer audio/video calls.
- **Event**: `webrtc_signal`
- **Payload**:
```json
{
  "targetSocketId": "socket_id_here",
  "signal": { ...webrtcObject }
}
```

#### server -> client: Relayed WebRTC Signal
- **Event**: `webrtc_signal_receive`
- **Payload**: `{ senderSocketId, senderUserId, senderPhone, signal }`

---

### 9.3 Chat & Handoff Operations

#### client -> server: Send Chat Message
- **Event**: `chat_message`
- **Payload**:
```json
{
  "text": "Help! Register a complaint for harassment. I am at 73.04, 33.68."
}
```

#### server -> client: Receive Message Response (AI assistant or human operator response)
- **Event**: `chat_message_receive`
- **Payload**:
```json
{
  "sender": "ai", // or "operator"
  "content": "I have successfully registered your harassment complaint. Incident ID: 648c0ccc...",
  "operatorPhone": null, // or '+923009876543' if sender is operator
  "timestamp": "2026-06-14T07:40:00.000Z"
}
```

#### server -> client: Chat State status notifications
Triggers when assistant transfers user to human operator.
- **Event**: `chat_status_update`
- **Payload**:
```json
{
  "status": "human", // 'ai' or 'human'
  "message": "Connecting to a live emergency agent..."
}
```

#### server -> operator: Alert operators of emergency Handoff requests
- **Event**: `handoff_request`
- **Payload**:
```json
{
  "userId": "648c08ef...",
  "phone": "+923001234567",
  "cnic": "4210112345678",
  "message": "User requested live emergency operator takeover."
}
```

#### client (Operator) -> server: Register dispatcher in operator listening pool
- **Event**: `register_operator`
- **Payload**: `null`
- **Callback Return**: `{ success: true }`

#### client (Operator) -> server: Operator Reply to User Chat
- **Event**: `operator_reply`
- **Payload**:
```json
{
  "targetUserId": "648c08ef...",
  "text": "Hello, I am Officer Amina. Help is on the way. Keep typing here to talk to me."
}
```
- **Callback Return**: `{ success: true }`

---

### 9.4 Community Peer Chat Operations

#### client -> server: Join Community Help Chat Room
Used by both seeker and helper to join the real-time chat room for their linked alert.
- **Event**: `join_community_chat`
- **Payload**:
```json
{
  "chatId": "6a2e585c464261dcb1e9f25a"
}
```
- **Callback Return**: `{ success: true }`

#### client -> server: Send Community Message (Real-Time)
- **Event**: `send_community_message`
- **Payload**:
```json
{
  "chatId": "6a2e585c464261dcb1e9f25a",
  "content": "I am standing near the Kashmiri road bridge."
}
```
- **Callback Return**: `{ success: true }`

#### server -> client: Receive Community Message
Emitted to all participants connected in the `community:chat:<chatId>` room.
- **Event**: `community_message_receive`
- **Payload**:
```json
{
  "chatId": "6a2e585c464261dcb1e9f25a",
  "senderId": "648c09ff...",
  "senderPhone": "+923009876543",
  "content": "I am standing near the Kashmiri road bridge.",
  "timestamp": "2026-06-14T07:42:00.000Z"
}
```

#### server -> client: Broadcast Nearby Alert
Emitted globally to all online socket clients whenever a new nearby help alert is generated.
- **Event**: `new_community_alert`
- **Payload**:
```json
{
  "alertId": "6a2e585c464261dcb1e9f259",
  "seekerId": "648c08ef...",
  "seekerPhone": "+923001234567",
  "location": [73.0479, 33.6844],
  "message": "My car wheel broke down on Kashmiri road. Needs manual help."
}
```

#### server -> client: Broadcast Closed Alert Status
Emitted globally when a seeker closes their alert.
- **Event**: `community_alert_resolved`
- **Payload**:
```json
{
  "alertId": "6a2e585c464261dcb1e9f259",
  "seekerId": "648c08ef..."
}
```
