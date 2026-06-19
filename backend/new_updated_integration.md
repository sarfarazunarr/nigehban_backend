# Nigehbaan API Integration Manual (Pusher & REST Upgrades)

This document outlines the changes made to the Nigehbaan backend communication architecture. We have successfully replaced the persistent Socket.io connection layer with a stateless **Pusher** event propagation network combined with **REST endpoints** for message submission. This layout enables seamless deployment on serverless infrastructures (such as Vercel) while keeping real-time features operational.

---

## 1. Pusher Real-Time Event Architecture

Client applications must configure a Pusher client instance. 

*   **Pusher Key**: `8becfba0db54590a6632`
*   **Cluster**: `ap2`
*   **TLS**: Required (`useTLS: true`)

### 1.1 Summary of Channels and Events

| Channel Name | Event Name | Trigger Source | Payload Details | Client Action / Role |
| :--- | :--- | :--- | :--- | :--- |
| **`role-B2G`** | `sos_dispatch_alert` | Backend SOS Service | `{ reporterId, reporterPhone, coordinates: [lng, lat], sessionId }` | Police Dispatch Consoles (Alert of active SOS) |
| **`operators`** | `handoff_request` | Backend Chat Controller | `{ userId, phone, cnic, message }` | All active human operators (takeover request) |
| **`operators`** | `operator_receive_message` | Backend Chat Controller | `{ userId, phone, content, timestamp }` | All human operators (sync user message in human mode) |
| **`operators`** | `operator_message_sync` | Backend Chat Controller | `{ userId, sender: 'operator', content, operatorPhone, timestamp }` | Multi-operator console sync (synchronizes response) |
| **`user-notifications-<userId>`** | `sos_alert` | Backend SOS Service | `{ reporterId, reporterPhone, coordinates: [lng, lat], sessionId }` | Ward's Trusted Contacts / Guardians (Alert popup) |
| **`user-notifications-<userId>`** | `chat_message_receive` | Backend Chat Controller | `{ sender: 'ai'\|'operator', content, operatorPhone, timestamp }` | Ward Mobile App (Receives AI response or operator reply) |
| **`user-notifications-<userId>`** | `chat_status_update` | Backend Chat Controller | `{ status: 'ai'\|'human', message }` | Ward Mobile App (Informs when human operator takes over) |
| **`user-notifications-<userId>`** | `location_request_received` | Backend Profile Controller | `{ requestedBy: { _id, phone, name } }` | Ward Mobile App (Prompts client device to report coordinates) |
| **`sos-room-<userId>`** | `location_update` | Backend SOS Service | `{ userId, coordinates: [lng, lat], timestamp }` | Active Dispatch Operator Tracking Screen (Update map marker) |
| **`sos-room-<userId>`** | `sos_resolved` | Backend SOS Service | `{ userId, resolvedAt }` | Active Dispatch Operator Tracking Screen (Close track) |
| **`community-alerts`** | `new_community_alert` | Backend Community Controller | `{ alertId, seekerId, seekerPhone, location: [lng, lat], message }` | Local Users Nearby (Notify of incident nearby) |
| **`community-alerts`** | `community_alert_resolved` | Backend Community Controller | `{ alertId, seekerId }` | Local Users Nearby (Clear resolved alert markers) |
| **`community-chat-<chatId>`** | `community_message_receive` | Backend Community Controller | `{ chatId, senderId, senderPhone, content, timestamp }` | Helper-Seeker Chat Session (Sync peer messages) |

---

## 2. Stateless Support Chat API (`/api/chat`)

Because WebSockets are no longer used to *send* messages, all chat interactions are driven by REST APIs.

### 2.1 Send User Chat Message (Ward -> AI or operator queue)
- **Method**: `POST`
- **Path**: `/api/chat/message`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
    ```json
    {
      "text": "Help, I feel unsafe walking down this street."
    }
    ```
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Message processed successfully."
    }
    ```
- **Real-Time Side Effects**:
    *   If chat state is in `ai` mode, the response from OpenAI is published to `user-notifications-<userId>` as a `chat_message_receive` event.
    *   If AI detects emergency handoff trigger, `handoff_request` and `chat_status_update` events are fired.
    *   If chat state is in `human` mode, the user message is appended to the database and published to the `operators` channel as an `operator_receive_message` event.

### 2.2 Reply to User Session (Operator -> Ward Takeover)
- **Method**: `POST`
- **Path**: `/api/chat/reply`
- **Headers**: `Authorization: Bearer <accessToken>` (Must belong to user with role `SuperAdmin` or `B2G`)
- **Body (JSON)**:
    ```json
    {
      "targetUserId": "648c08ef1234567890abcdef",
      "text": "An officer has been dispatched to your location. Stay on the line."
    }
    ```
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Reply sent successfully."
    }
    ```
- **Real-Time Side Effects**:
    *   Updates the session status to `human` and assigns the active operator.
    *   Pushes message to `user-notifications-<targetUserId>` under event `chat_message_receive`.
    *   Pushes message to `operators` under event `operator_message_sync` to keep other operator tabs synchronized.

### 2.3 Close Operator Session & Revert to AI
- **Method**: `POST`
- **Path**: `/api/chat/close`
- **Headers**: `Authorization: Bearer <accessToken>` (Must belong to role `SuperAdmin` or `B2G`)
- **Body (JSON)**:
    ```json
    {
      "targetUserId": "648c08ef1234567890abcdef"
    }
    ```
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Chat session closed and reverted to AI successfully."
    }
    ```

---

## 3. Multi-Language Safety Resources (`/api/laws`)

Safety Resource entries now require both `category` and `language` parameters.

*   **Supported Languages**: `english`, `urdu`, `sindhi`
*   **Compound Unique Key**: `{ category, language }`

### 3.1 Fetch All Safety Resources (Minimal List)
- **Method**: `GET`
- **Path**: `/api/laws`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "_id": "6d9b0711aaabbbcccddd0001",
          "category": "harassment",
          "language": "english",
          "title": "Protection against Harassment Act Section 509",
          "createdAt": "2026-06-19T07:00:00.000Z"
        },
        {
          "_id": "6d9b0711aaabbbcccddd0002",
          "category": "harassment",
          "language": "urdu",
          "title": "ہراسگی کے خلاف تحفظ کا قانون دفعہ 509",
          "createdAt": "2026-06-19T07:05:00.000Z"
        }
      ]
    }
    ```

### 3.2 Fetch Full Resource Details by Category and Language
- **Method**: `GET`
- **Path**: `/api/laws/category/:category/:language`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "_id": "6d9b0711aaabbbcccddd0002",
        "category": "harassment",
        "language": "urdu",
        "title": "ہراسگی کے خلاف تحفظ کا قانون دفعہ 509",
        "legalDescription": "ہراسگی کے خلاف تفصیلی معلومات اور دفعہ کا متن...",
        "survivalInstructions": [
          "شور مچائیں اور لوگوں کی توجہ حاصل کریں",
          "ہراساں کرنے والے کی تفصیلات اور وقت نوٹ کریں"
        ],
        "precautions": [
          "غیر محفوظ یا اندھیری جگہوں سے پرہیز کریں",
          "اپنے سرپرست کے ساتھ لائیو لوکیشن شیئر کریں"
        ]
      }
    }
    ```

### 3.3 Create or Update Safety Resource (SuperAdmin Only)
- **Method**: `POST`
- **Path**: `/api/laws`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Body (JSON)**:
    ```json
    {
      "category": "harassment",
      "language": "sindhi",
      "title": "حراسگي خلاف تحفظ جو قانون دفعو 509",
      "legalDescription": "سندھ حراسگي قانوني تفصيل...",
      "survivalInstructions": [
        "مدد لاء آواز ڏيو",
        "شواهد گڏ ڪريو"
      ],
      "precautions": [
        "پنهنجي سرپرست سان رابطي ۾ رهو"
      ]
    }
    ```

### 3.4 Delete Safety Resource (SuperAdmin Only)
- **Method**: `DELETE`
- **Path**: `/api/laws/category/:category/:language`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Law resource for category 'harassment' in language 'sindhi' deleted successfully."
    }
    ```
