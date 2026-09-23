# Pet App — Development Specification

> Development Source of Truth  
> Mobile: **React Native CLI + TypeScript (NO EXPO)**  
> Backend: **FastAPI + Python**  
> Database: **PostgreSQL**  
> Version: 1.0

---

# 1. Project Overview

ระบบสำหรับเจ้าของสุนัขและแมว โดยมีเป้าหมายหลักคือ:

- ลงทะเบียนสัตว์เลี้ยง
- สร้าง Pet ID และ QR Code
- แจ้งสัตว์หาย
- แจ้งพบสัตว์
- แจ้งเบาะแส / จุดที่พบเห็น
- แสดงสัตว์หายหรือสัตว์ที่พบในบริเวณใกล้เคียง
- แชร์ประกาศไปยัง Social Media
- ติดต่อระหว่างเจ้าของสัตว์และผู้พบสัตว์
- แจ้งเตือนตามพื้นที่
- มีระบบโฆษณาภายในแอป
- รองรับ Pet Guardian / สมาชิกครอบครัว
- รองรับข้อมูลสุขภาพสัตว์ในอนาคต
- รองรับ AI Matching ใน Phase ถัดไป

แนวคิดหลักของ Product:

```text
Pet Identity
    +
Lost & Found
    +
Location Network
    +
Community
    +
Notifications
```

แอปต้องใช้งานง่าย อบอุ่น เป็นมิตรกับสัตว์ และไม่ให้ความรู้สึกเหมือนระบบโรงพยาบาลหรือระบบราชการ

---

# 2. Mandatory Technical Stack

## 2.1 Mobile Application

ใช้:

```text
React Native CLI
TypeScript
```

ห้ามใช้:

```text
Expo
expo-router
expo-camera
expo-location
expo-notifications
expo-image-picker
หรือ package ใดๆ ที่ต้องพึ่ง Expo Runtime
```

รองรับ:

```text
Android
iOS
```

Native Project ต้องมี:

```text
/android
/ios
```

## 2.2 Recommended Mobile Libraries

Navigation:

```text
@react-navigation/native
@react-navigation/native-stack
@react-navigation/bottom-tabs
```

State:

```text
zustand
```

Server State:

```text
@tanstack/react-query
```

HTTP:

```text
axios
```

Forms:

```text
react-hook-form
zod
@hookform/resolvers
```

Secure Storage:

```text
react-native-keychain
```

Images:

```text
react-native-image-picker
react-native-fast-image
```

Camera / QR:

เลือก Native-compatible package ที่ไม่ต้องใช้ Expo

ตัวอย่าง:

```text
react-native-vision-camera
```

Maps:

```text
react-native-maps
```

หรือ Mapbox หากภายหลังต้องการความสามารถด้านแผนที่ขั้นสูง

Permissions:

```text
react-native-permissions
```

Push Notification:

```text
@react-native-firebase/app
@react-native-firebase/messaging
```

Animation:

```text
react-native-reanimated
```

Icons:

```text
react-native-vector-icons
```

---

# 3. Backend Stack

ใช้:

```text
Python 3.12+
FastAPI
Pydantic v2
SQLAlchemy 2.x
Alembic
PostgreSQL
Redis
Uvicorn
```

Authentication:

```text
JWT Access Token
JWT Refresh Token
```

Password:

```text
Argon2 หรือ bcrypt
```

Object Storage:

```text
Cloudflare R2
หรือ S3-compatible Object Storage
```

Background Jobs:

แนะนำ:

```text
ARQ
```

หรือ:

```text
Celery
```

Cache / Queue:

```text
Redis
```

Realtime:

```text
FastAPI WebSocket
```

Container:

```text
Docker
Docker Compose
```

---

# 4. Repository Structure

แนะนำ Monorepo:

```text
pet-app/
│
├── mobile/
│   ├── android/
│   ├── ios/
│   │
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.api.ts
│   │   │   ├── pets.api.ts
│   │   │   ├── lostFound.api.ts
│   │   │   ├── sightings.api.ts
│   │   │   ├── chat.api.ts
│   │   │   ├── notifications.api.ts
│   │   │   └── ads.api.ts
│   │   │
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── cards/
│   │   │   ├── forms/
│   │   │   ├── pet/
│   │   │   └── map/
│   │   │
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── pets/
│   │   │   ├── lost-found/
│   │   │   ├── sightings/
│   │   │   ├── map/
│   │   │   ├── chat/
│   │   │   ├── notifications/
│   │   │   ├── guardians/
│   │   │   ├── ads/
│   │   │   └── profile/
│   │   │
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── theme/
│   │   ├── types/
│   │   ├── utils/
│   │   └── config/
│   │
│   ├── App.tsx
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── pets.py
│   │   │       ├── lost_posts.py
│   │   │       ├── found_posts.py
│   │   │       ├── sightings.py
│   │   │       ├── guardians.py
│   │   │       ├── chat.py
│   │   │       ├── notifications.py
│   │   │       ├── uploads.py
│   │   │       ├── ads.py
│   │   │       └── admin.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── database.py
│   │   │   ├── redis.py
│   │   │   └── exceptions.py
│   │   │
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── websocket/
│   │   ├── tasks/
│   │   ├── utils/
│   │   └── main.py
│   │
│   ├── alembic/
│   ├── tests/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/
│   ├── pet_app_product_ui_spec.md
│   └── PET_APP_DEVELOPMENT_SPEC.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

# 5. Backend Architecture

ใช้ Layered Architecture:

```text
Router
  ↓
Service
  ↓
Repository
  ↓
SQLAlchemy Model
  ↓
PostgreSQL
```

ห้ามเขียน Business Logic จำนวนมากใน API Router

ตัวอย่าง:

```text
api/v1/pets.py
    ↓
services/pet_service.py
    ↓
repositories/pet_repository.py
    ↓
models/pet.py
```

---

# 6. API Base URL

Production:

```text
https://api.example.com/api/v1
```

Local:

```text
http://localhost:8000/api/v1
```

Health Check:

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

---

# 7. Standard API Response

Success:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PET_NOT_FOUND",
    "message": "Pet not found",
    "details": null
  }
}
```

---

# 8. HTTP Status Codes

ใช้มาตรฐานดังนี้:

| HTTP | ใช้งาน |
|---|---|
| 200 | GET / PUT / PATCH สำเร็จ |
| 201 | Create สำเร็จ |
| 204 | Delete สำเร็จโดยไม่มี Response Body |
| 400 | Request ไม่ถูกต้อง |
| 401 | ไม่ได้ Login / Token ไม่ถูกต้อง |
| 403 | Login แล้ว แต่ไม่มีสิทธิ์ |
| 404 | Resource ไม่พบ |
| 409 | Conflict เช่น Email ซ้ำ |
| 422 | Validation Error |
| 429 | Rate Limit |
| 500 | Internal Server Error |

---

# 9. User Authentication

รองรับ:

```text
Email + Password
Phone + OTP (Phase 2)
Apple Sign In (Phase 2)
Google Sign In (Phase 2)
```

MVP เริ่มจาก:

```text
Email + Password
```

## Register

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "display_name": "Big"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "Big"
    },
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

Status:

```text
201
```

## Login

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

## Refresh Token

```http
POST /api/v1/auth/refresh
```

## Logout

```http
POST /api/v1/auth/logout
```

---

# 10. JWT

Access Token:

```text
15-30 minutes
```

Refresh Token:

```text
30 days
```

Mobile ต้องเก็บ Token ด้วย:

```text
react-native-keychain
```

ห้ามเก็บ Token ใน:

```text
AsyncStorage
```

ถ้าเป็นข้อมูลสำคัญเกี่ยวกับ Authentication

---

# 11. User Model

Table:

```text
users
```

Fields:

```text
id UUID PK
email VARCHAR UNIQUE
password_hash VARCHAR
display_name VARCHAR
phone VARCHAR NULL
avatar_url TEXT NULL
status VARCHAR
role VARCHAR
created_at TIMESTAMP
updated_at TIMESTAMP
last_login_at TIMESTAMP NULL
```

Role:

```text
user
admin
moderator
```

---

# 12. Pet Profile

สัตว์หนึ่งตัวต้องมี Pet ID ของตัวเอง

Table:

```text
pets
```

Fields:

```text
id UUID PK

owner_id UUID FK users.id

pet_code VARCHAR UNIQUE
qr_token VARCHAR UNIQUE

name VARCHAR
animal_type VARCHAR
breed VARCHAR NULL
gender VARCHAR NULL
color VARCHAR NULL

birth_date DATE NULL
weight DECIMAL NULL

description TEXT NULL
distinctive_marks TEXT NULL

microchip_id VARCHAR NULL

profile_image_url TEXT NULL

status VARCHAR

is_public BOOLEAN

created_at TIMESTAMP
updated_at TIMESTAMP
```

animal_type:

```text
dog
cat
other
```

status:

```text
normal
lost
found
deceased
inactive
```

---

# 13. Create Pet

```http
POST /api/v1/pets
```

Request:

```json
{
  "name": "Momo",
  "animal_type": "cat",
  "breed": "Domestic Shorthair",
  "gender": "female",
  "color": "white-orange",
  "birth_date": "2024-02-12",
  "description": "Friendly indoor cat",
  "distinctive_marks": "Orange spot above left eye"
}
```

Response:

```text
201 Created
```

---

# 14. Pet API

```http
GET    /api/v1/pets
GET    /api/v1/pets/{pet_id}
POST   /api/v1/pets
PATCH  /api/v1/pets/{pet_id}
DELETE /api/v1/pets/{pet_id}
```

---

# 15. Pet QR Code

สัตว์แต่ละตัวมี:

```text
pet_code
qr_token
```

ตัวอย่าง URL:

```text
https://petapp.example/p/{qr_token}
```

QR ต้องไม่ฝัง:

```text
owner_id
phone
email
home address
```

ตรงๆ ใน QR

QR ควรเป็น Random Secure Token

---

# 16. Public Pet Profile

Endpoint:

```http
GET /api/v1/public/pets/qr/{qr_token}
```

แสดงเฉพาะข้อมูล Public เช่น:

```json
{
  "pet": {
    "name": "Momo",
    "animal_type": "cat",
    "breed": "Domestic Shorthair",
    "color": "white-orange",
    "profile_image_url": "...",
    "status": "lost",
    "emergency_note": "Do not feed chicken"
  },
  "actions": {
    "report_found": true,
    "contact_owner": true
  }
}
```

ห้ามแสดงข้อมูลส่วนตัวเจ้าของโดย Default

---

# 17. Lost Pet Post

Table:

```text
lost_posts
```

Fields:

```text
id UUID PK

pet_id UUID FK pets.id
owner_id UUID FK users.id

status VARCHAR

title VARCHAR
description TEXT NULL

lost_at TIMESTAMP
latitude DECIMAL
longitude DECIMAL

location_text VARCHAR NULL

search_radius_km DECIMAL DEFAULT 5

reward_enabled BOOLEAN
reward_text VARCHAR NULL

share_token VARCHAR UNIQUE

created_at TIMESTAMP
updated_at TIMESTAMP
closed_at TIMESTAMP NULL
```

status:

```text
active
resolved
cancelled
```

---

# 18. Create Lost Post

```http
POST /api/v1/lost-posts
```

Request:

```json
{
  "pet_id": "uuid",
  "lost_at": "2026-09-22T11:30:00+07:00",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "location_text": "Ratchada, Bangkok",
  "search_radius_km": 5,
  "description": "Last seen near the main road",
  "reward_enabled": false
}
```

Backend ต้อง:

```text
1. Verify owner
2. Create lost post
3. Update pet.status = lost
4. Queue Nearby Notification
5. Return created lost post
```

Response:

```text
201
```

---

# 19. Lost Post APIs

```http
GET   /api/v1/lost-posts
GET   /api/v1/lost-posts/{id}
POST  /api/v1/lost-posts
PATCH /api/v1/lost-posts/{id}
POST  /api/v1/lost-posts/{id}/resolve
POST  /api/v1/lost-posts/{id}/cancel
```

---

# 20. Found Pet Post

ใช้เมื่อเจอสัตว์แต่ไม่รู้เจ้าของ

Table:

```text
found_posts
```

Fields:

```text
id UUID PK

reporter_id UUID NULL

animal_type VARCHAR
breed_guess VARCHAR NULL
color VARCHAR NULL

description TEXT NULL

found_at TIMESTAMP

latitude DECIMAL
longitude DECIMAL

location_text VARCHAR NULL

status VARCHAR

created_at TIMESTAMP
updated_at TIMESTAMP
```

status:

```text
active
matched
resolved
cancelled
```

---

# 21. Found Post API

```http
GET   /api/v1/found-posts
GET   /api/v1/found-posts/{id}
POST  /api/v1/found-posts
PATCH /api/v1/found-posts/{id}
POST  /api/v1/found-posts/{id}/resolve
```

---

# 22. Sighting

Sighting คือการแจ้งว่า:

```text
"ฉันเห็นสัตว์ตัวนี้"
```

แต่ไม่ได้จับสัตว์ไว้

Table:

```text
sightings
```

Fields:

```text
id UUID PK

lost_post_id UUID FK lost_posts.id

reporter_id UUID NULL

seen_at TIMESTAMP

latitude DECIMAL
longitude DECIMAL

location_text VARCHAR NULL

direction VARCHAR NULL

description TEXT NULL

created_at TIMESTAMP
```

---

# 23. Sighting API

```http
POST /api/v1/lost-posts/{lost_post_id}/sightings
GET  /api/v1/lost-posts/{lost_post_id}/sightings
```

Request:

```json
{
  "seen_at": "2026-09-22T14:20:00+07:00",
  "latitude": 13.755,
  "longitude": 100.502,
  "direction": "north",
  "description": "Saw a similar cat crossing the street"
}
```

เมื่อสร้าง Sighting ใหม่:

```text
1. Save sighting
2. Notify pet owner
3. Notify users following this lost case
4. Update last_seen information
```

---

# 24. Nearby Search

Endpoint:

```http
GET /api/v1/nearby
```

Parameters:

```text
latitude
longitude
radius_km
animal_type
post_type
status
```

Example:

```http
GET /api/v1/nearby?latitude=13.7563&longitude=100.5018&radius_km=5
```

Response:

```json
{
  "success": true,
  "data": {
    "lost": [],
    "found": []
  }
}
```

---

# 25. Geospatial Database

MVP สามารถใช้:

```text
PostgreSQL
```

Production แนะนำ:

```text
PostgreSQL + PostGIS
```

เพื่อรองรับ:

```text
distance calculation
radius search
nearby sorting
map bounding box
geospatial indexes
```

ตัวอย่าง:

```text
ST_DWithin
ST_Distance
```

ห้ามทำ Distance Filtering ทั้งหมดบน Mobile

---

# 26. Map

Map Screen ต้องแสดง:

```text
Lost Pets
Found Pets
Sightings
```

Pin Type:

```text
Lost = Emergency Red
Found = Blue/Teal
Sighting = Amber
```

Filter:

```text
Dog
Cat

Lost
Found
Sighting

1 km
3 km
5 km
10 km

Today
3 Days
7 Days
30 Days
```

---

# 27. Social Sharing

ทุก Lost / Found Post ต้องสามารถ Share ได้

รองรับ:

```text
Facebook
LINE
Instagram
X
Native Share Sheet
Copy Link
```

ใช้ React Native Native Share:

```text
Share API
```

Backend ต้องสร้าง Public Link เช่น:

```text
https://petapp.example/lost/{share_token}
```

---

# 28. Share Card

ระบบควรสร้าง Share Card Image:

```text
Pet Photo

LOST PET

Momo
Female Cat
White / Orange

Last seen:
Ratchada, Bangkok

22 Sep 2026

QR Code
```

Backend สามารถ generate image ภายหลัง หรือให้ Mobile generate ใน MVP

แนะนำให้ Backend Generate เพื่อให้รูปแบบ Consistent

---

# 29. Pet Guardian

เจ้าของสามารถเพิ่มผู้ดูแลสัตว์

Table:

```text
pet_guardians
```

Fields:

```text
id UUID PK

pet_id UUID
user_id UUID

role VARCHAR

can_edit BOOLEAN
can_mark_lost BOOLEAN
can_view_private_info BOOLEAN
can_receive_notifications BOOLEAN

created_at TIMESTAMP
```

Role:

```text
owner
family
guardian
caretaker
```

---

# 30. Guardian API

```http
GET    /api/v1/pets/{pet_id}/guardians
POST   /api/v1/pets/{pet_id}/guardians
PATCH  /api/v1/pets/{pet_id}/guardians/{guardian_id}
DELETE /api/v1/pets/{pet_id}/guardians/{guardian_id}
```

---

# 31. Chat

Owner และ Finder สามารถ Chat กัน

Table:

```text
conversations
```

```text
id UUID
type VARCHAR
reference_id UUID
created_at TIMESTAMP
```

Table:

```text
conversation_members
```

```text
conversation_id UUID
user_id UUID
```

Table:

```text
messages
```

```text
id UUID
conversation_id UUID
sender_id UUID
message_type VARCHAR
content TEXT NULL
image_url TEXT NULL
created_at TIMESTAMP
read_at TIMESTAMP NULL
```

message_type:

```text
text
image
location
system
```

---

# 32. Chat REST API

```http
GET  /api/v1/conversations
GET  /api/v1/conversations/{id}
GET  /api/v1/conversations/{id}/messages
POST /api/v1/conversations/{id}/messages
```

Realtime:

```text
WebSocket
```

Endpoint:

```text
/ws/chat/{conversation_id}
```

---

# 33. Push Notification

รองรับ:

```text
Firebase Cloud Messaging
Apple Push Notification Service
```

Notification Events:

```text
Nearby lost pet alert
New sighting
Someone found your pet
New message
Guardian invitation
Lost case update
Pet found / resolved
Health reminder
Promotion / Sponsored notification
```

---

# 34. Device Token

Table:

```text
device_tokens
```

Fields:

```text
id UUID
user_id UUID

platform VARCHAR

token TEXT

device_id VARCHAR NULL

is_active BOOLEAN

created_at TIMESTAMP
updated_at TIMESTAMP
```

platform:

```text
ios
android
```

API:

```http
POST   /api/v1/devices
DELETE /api/v1/devices/{device_id}
```

---

# 35. Notification Preferences

User เลือกได้:

```text
Lost pet alerts
Radius
Dog only
Cat only
Chat notifications
Guardian notifications
Marketing notifications
```

Table:

```text
notification_preferences
```

---

# 36. File Upload

รูปสัตว์และรูปโพสต์ไม่เก็บใน PostgreSQL

เก็บใน:

```text
Cloudflare R2
หรือ S3-compatible Storage
```

API:

```http
POST /api/v1/uploads/presign
```

Flow:

```text
Mobile
 ↓
Request Pre-signed URL
 ↓
Backend
 ↓
R2/S3 Presigned URL
 ↓
Mobile uploads directly
 ↓
Mobile sends object URL/key to Backend
```

ข้อดี:

```text
ลด Load FastAPI
Scale ง่าย
```

---

# 37. Pet Images

Table:

```text
pet_images
```

```text
id UUID
pet_id UUID
image_url TEXT
is_primary BOOLEAN
created_at TIMESTAMP
```

---

# 38. Post Images

Table:

```text
post_images
```

```text
id UUID

post_type VARCHAR
post_id UUID

image_url TEXT

created_at TIMESTAMP
```

---

# 39. Ads

รองรับโฆษณาภายในแอป

Ad Types:

```text
Banner
Native Card
Sponsored Post
Sponsored Nearby Business
```

Position:

```text
Home Feed
Nearby Feed
Lost/Found Feed
Pet Profile recommendations
```

ไม่ควรแสดง Ads:

```text
ระหว่างขั้นตอนแจ้งสัตว์หาย
หน้า Emergency QR
หน้า Contact Owner
```

---

# 40. Ads Model

Table:

```text
ads
```

Fields:

```text
id UUID

advertiser_name VARCHAR
title VARCHAR
description TEXT

image_url TEXT

target_url TEXT NULL

ad_type VARCHAR

start_at TIMESTAMP
end_at TIMESTAMP

status VARCHAR

target_latitude DECIMAL NULL
target_longitude DECIMAL NULL
target_radius_km DECIMAL NULL

created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 41. Ads Metrics

Table:

```text
ad_events
```

```text
id UUID
ad_id UUID
user_id UUID NULL

event_type VARCHAR

created_at TIMESTAMP
```

event_type:

```text
impression
click
```

---

# 42. Reporting / Moderation

ผู้ใช้สามารถ Report:

```text
Post
User
Message
Ad
```

Reasons:

```text
Spam
Fake post
Fraud
Inappropriate content
Animal abuse concern
Harassment
Other
```

Table:

```text
reports
```

---

# 43. Block User

API:

```http
POST   /api/v1/users/{user_id}/block
DELETE /api/v1/users/{user_id}/block
```

เมื่อ Block:

```text
ไม่เห็น Chat
ไม่สามารถเริ่ม Conversation ใหม่
ลดการมองเห็น Content ระหว่างกัน
```

---

# 44. Admin Backend

Admin สามารถ:

```text
View users
View pets
View lost posts
View found posts
View sightings
Resolve reports
Suspend users
Remove posts
Manage ads
View app metrics
```

Admin API:

```text
/api/v1/admin/*
```

ต้องตรวจ:

```text
role = admin
```

---

# 45. Audit Logs

Table:

```text
audit_logs
```

Fields:

```text
id UUID

actor_user_id UUID NULL

action VARCHAR
resource_type VARCHAR
resource_id UUID NULL

metadata JSONB

created_at TIMESTAMP
```

---

# 46. Pet Health — Phase 2

เพิ่ม:

```text
Vaccinations
Medication
Allergies
Conditions
Weight Tracking
Vet Appointments
Health Notes
```

Table:

```text
pet_health_records
```

---

# 47. Vaccination

Table:

```text
vaccinations
```

```text
id UUID
pet_id UUID

name VARCHAR

given_at DATE
next_due_at DATE NULL

clinic_name VARCHAR NULL

note TEXT NULL

created_at TIMESTAMP
```

---

# 48. Emergency Information

เจ้าของเลือกข้อมูล Public ได้

เช่น:

```text
Allergy
Medication
Medical condition
Do not feed...
Emergency note
```

ต้องแยก:

```text
private health data
public emergency data
```

อย่างชัดเจน

---

# 49. AI Matching — Phase 2/3

ระบบอาจจับคู่:

```text
Lost Pet
vs
Found Pet
```

โดยใช้:

```text
Animal Type
Color
Breed
Image Similarity
Location Distance
Lost Time
Found Time
Distinctive Marks
```

ผลลัพธ์:

```text
Possible Match
```

ห้าม Auto Confirm ว่าเป็นสัตว์ตัวเดียวกัน

User / Owner ต้องเป็นคนยืนยัน

---

# 50. Matching Model

Table:

```text
match_candidates
```

```text
id UUID

lost_post_id UUID
found_post_id UUID

score DECIMAL

status VARCHAR

created_at TIMESTAMP
```

status:

```text
suggested
accepted
rejected
```

---

# 51. Mobile Navigation

แนะนำ Bottom Tab:

```text
Home
Nearby
Report
My Pets
Profile
```

Tab Structure:

```text
Home
 ├── Nearby Alerts
 ├── Active Lost Cases
 ├── Recent Found Pets
 └── Sponsored Cards

Nearby
 ├── Map
 └── Feed

Report
 ├── Lost Pet
 ├── Found Pet
 └── Sighting

My Pets
 ├── Pet List
 ├── Pet Detail
 ├── QR
 ├── Guardians
 └── Health

Profile
 ├── Account
 ├── Notifications
 ├── Privacy
 ├── My Posts
 └── Settings
```

---

# 52. Core User Flows

## Lost Pet

```text
My Pets
 ↓
Select Pet
 ↓
Report Lost
 ↓
Location
 ↓
Time
 ↓
Description
 ↓
Preview
 ↓
Publish
 ↓
Notify Nearby Users
```

Pet information ต้อง Auto-fill

ไม่ให้กรอกข้อมูลสัตว์ใหม่ทั้งหมด

---

## Found Pet

```text
Report
 ↓
Found Pet
 ↓
Take / Select Photo
 ↓
Animal Type
 ↓
Current Location
 ↓
Description
 ↓
Publish
 ↓
Matching
```

---

## Sighting

```text
Lost Pet Detail
 ↓
I Saw This Pet
 ↓
Location
 ↓
Time
 ↓
Optional Photo
 ↓
Direction
 ↓
Submit
```

---

## QR Scan

```text
Scan QR
 ↓
Pet Public Profile
 ↓
Report Found
   OR
Contact Owner
```

---

# 53. UI Direction

Theme:

```text
Friendly
Warm
Soft
Trustworthy
Modern
Pet-friendly
Professional
```

หลีกเลี่ยง:

```text
Hospital look
Corporate blue-heavy UI
Dark gray-heavy UI
Sharp corners
Aggressive warning colors
Too much red
```

---

# 54. Main Color Palette

Primary:

```text
Warm Teal
#2FA89A
```

Primary Dark:

```text
#237F75
```

Primary Light:

```text
#DDF4F0
```

Secondary:

```text
Soft Peach
#FFB38A
```

Secondary Light:

```text
#FFF0E8
```

Background:

```text
Warm Cream
#FFF9F4
```

Card:

```text
#FFFFFF
```

Accent:

```text
Sunny Yellow
#FFD166
```

Text Primary:

```text
#263238
```

Text Secondary:

```text
#68757A
```

Border:

```text
#E8E4E0
```

Success:

```text
#55B685
```

Info:

```text
#5A9BD5
```

Warning:

```text
#F2A93B
```

Emergency / Lost:

```text
#E85D5D
```

Red ใช้เฉพาะ:

```text
Lost
Emergency
Destructive Action
Critical Alert
```

---

# 55. UI Design Tokens

Border Radius:

```text
Small: 10
Medium: 16
Large: 22
XL: 28
```

Cards:

```text
border-radius: 20
soft shadow
white background
comfortable padding
```

Buttons:

```text
height: 52-56
border-radius: 16
```

Input:

```text
height: 52
border-radius: 14
```

---

# 56. Typography

แนวทาง:

```text
Readable
Friendly
Modern
```

Thai:

สามารถใช้:

```text
Noto Sans Thai
LINE Seed Sans TH
Prompt
```

Mobile App ต้องตรวจ License ก่อน Bundle Font

Scale:

```text
Display: 30-34
H1: 26
H2: 22
H3: 18
Body: 16
Small: 14
Caption: 12
```

---

# 57. Pet Card

Card ควรมี:

```text
Pet Image
Name
Animal / Breed
Distance
Status Badge
Last Seen
```

ตัวอย่าง:

```text
┌──────────────────────────────┐
│ [ Momo Photo ]               │
│                              │
│ Momo                 LOST    │
│ Female Cat · White/Orange    │
│                              │
│ 📍 1.2 km away               │
│ Last seen 18 minutes ago     │
└──────────────────────────────┘
```

---

# 58. Lost Alert UI

Lost Alert ต้องเด่น แต่ไม่ทำ UI ทั้งหน้ากลายเป็นสีแดง

ใช้:

```text
Cream background
White cards
Red status pill
Red alert icon
```

ไม่ใช้:

```text
Full red screen
```

---

# 59. Empty States

เช่น:

```text
No lost pets nearby
```

ให้ใช้ Illustration / Icon เป็นมิตร เช่น:

```text
Happy pet
Paw
Home
Map
```

พร้อมข้อความ:

```text
ยังไม่มีประกาศสัตว์หายในบริเวณนี้
```

---

# 60. Accessibility

ขั้นต่ำ:

```text
Touchable target >= 44x44
Text contrast readable
Screen reader labels
Do not rely on color only
Support Dynamic Text where practical
```

---

# 61. Privacy

ข้อมูลต่อไปนี้ Private โดย Default:

```text
Email
Phone
Home Address
Exact Owner Location
Health Records
Private Pet Notes
```

Public Profile แสดงเฉพาะข้อมูลที่จำเป็น

---

# 62. Location Privacy

ห้ามเผย Exact Home Location

Lost Post สามารถใช้ Exact Coordinate สำหรับระบบ Matching ได้

แต่ Public UI อาจ:

```text
round coordinates
หรือแสดง approximate area
```

ตาม Privacy Setting

---

# 63. Security

Backend ต้องมี:

```text
JWT validation
Authorization checks
Input validation
Rate limiting
Upload validation
Content type validation
File size limits
Secure password hashing
Refresh token rotation
CORS configuration
SQL parameterization via ORM
```

---

# 64. Rate Limit

ตัวอย่าง:

```text
Login:
10 requests / minute / IP

Register:
5 requests / hour / IP

QR Lookup:
60 requests / minute / IP

Create Post:
10 requests / hour / user

Chat:
reasonable per-user throttling
```

เก็บ Counter ใน Redis

---

# 65. Image Validation

Allowed:

```text
JPEG
PNG
WEBP
HEIC (mobile upload; backend can convert)
```

กำหนด:

```text
Max upload size
Image dimensions
MIME validation
```

ห้ามเชื่อ File Extension อย่างเดียว

---

# 66. Environment Variables

`.env.example`

```env
APP_ENV=development

API_V1_PREFIX=/api/v1

DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/petapp

REDIS_URL=redis://redis:6379/0

JWT_SECRET=
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=30

S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PUBLIC_BASE_URL=

FCM_PROJECT_ID=
FCM_CREDENTIALS_JSON=

CORS_ORIGINS=
```

ห้าม Commit:

```text
.env
Secrets
Service Account
Private Keys
```

---

# 67. Docker Compose

Services:

```text
backend
postgres
redis
```

Optional:

```text
worker
```

Architecture:

```text
Mobile
   ↓ HTTPS
FastAPI
   ├── PostgreSQL
   ├── Redis
   ├── R2/S3
   ├── Push Notification
   └── Background Worker
```

---

# 68. Logging

Backend ต้องใช้ Structured Logging

Log:

```text
request_id
method
path
status_code
latency
user_id if available
```

ห้าม Log:

```text
password
JWT
refresh_token
private health data
secret keys
```

---

# 69. Error Codes

แนะนำ Application Error Codes:

```text
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_INVALID_TOKEN
AUTH_FORBIDDEN

USER_NOT_FOUND
USER_EMAIL_EXISTS

PET_NOT_FOUND
PET_FORBIDDEN
PET_INVALID_STATUS

LOST_POST_NOT_FOUND
LOST_POST_ALREADY_RESOLVED

FOUND_POST_NOT_FOUND

SIGHTING_NOT_FOUND

UPLOAD_INVALID_TYPE
UPLOAD_TOO_LARGE

CONVERSATION_NOT_FOUND
MESSAGE_FORBIDDEN

RATE_LIMIT_EXCEEDED

INTERNAL_ERROR
```

---

# 70. Pagination

Feed Endpoint ใช้ Cursor Pagination

Request:

```text
?limit=20&cursor=...
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "next_cursor": "..."
  }
}
```

หลีกเลี่ยง Offset Pagination สำหรับ Feed ใหญ่

---

# 71. Sorting

Nearby:

```text
distance ASC
```

Feed:

```text
created_at DESC
```

Lost Cases สามารถเพิ่ม Ranking:

```text
distance
recency
active status
```

---

# 72. Database Indexes

ต้องมี Index อย่างน้อย:

```text
users.email

pets.owner_id
pets.pet_code
pets.qr_token

lost_posts.pet_id
lost_posts.owner_id
lost_posts.status
lost_posts.created_at

found_posts.status
found_posts.created_at

sightings.lost_post_id
sightings.created_at

messages.conversation_id
messages.created_at

device_tokens.user_id
```

ถ้าใช้ PostGIS:

```text
GIST index
```

สำหรับ Location

---

# 73. Soft Delete

ข้อมูลสำคัญแนะนำใช้:

```text
deleted_at
```

แทน Physical Delete ทันที

โดยเฉพาะ:

```text
users
pets
posts
messages
```

Admin สามารถ Audit ได้

---

# 74. Date and Time

Backend เก็บ:

```text
UTC
```

Mobile แสดงตาม Local Timezone

API:

```text
ISO 8601
```

เช่น:

```text
2026-09-22T07:30:00Z
```

---

# 75. Localization

เตรียม Architecture ให้รองรับ:

```text
th
en
```

ห้าม Hardcode Text กระจายทั่ว Component

สร้าง:

```text
src/locales/
```

---

# 76. Analytics Events

Events:

```text
app_open

pet_created
pet_qr_viewed
pet_qr_scanned

lost_post_created
lost_post_shared
lost_post_resolved

found_post_created

sighting_created

chat_started

ad_impression
ad_clicked
```

ต้องไม่ส่งข้อมูล Sensitive เข้า Analytics

---

# 77. MVP Scope

MVP ต้องมี:

1. Register / Login
2. User Profile
3. Pet Profile
4. Pet Image
5. Pet ID
6. QR Code
7. QR Scan
8. Public Pet Profile
9. Lost Pet Post
10. Found Pet Post
11. Sighting
12. Nearby Feed
13. Map
14. Radius Search
15. Push Notification
16. Social Sharing
17. Owner / Finder Chat
18. Mark Found / Resolve Case
19. Report Content
20. Block User
21. Ads
22. Admin API
23. Basic Admin Dashboard

---

# 78. Phase 2

เพิ่ม:

```text
Pet Guardian
Vaccination
Medication
Health Reminder
Pet Weight
Vet Appointment
Advanced Notification Settings
Phone OTP
Google Sign In
Apple Sign In
```

---

# 79. Phase 3

เพิ่ม:

```text
AI Lost/Found Matching
Microchip integration
Partner Pet Clinics
Pet Shops
Pet Insurance
GPS Tracker integration
Marketplace
Advanced Advertising
Sponsored Lost Alerts
```

---

# 80. Implementation Order

Cursor / Developer ต้องทำตามลำดับนี้

## Phase A — Foundation

```text
Repository Structure
FastAPI Project
PostgreSQL
Redis
Alembic
Docker Compose
React Native CLI Project
Theme
Navigation
API Client
Environment Config
```

## Phase B — Authentication

```text
Register
Login
Refresh Token
Logout
User Profile
Secure Token Storage
```

## Phase C — Pet

```text
Pet CRUD
Pet Image
Pet ID
QR Token
QR View
QR Scan
Public Pet Profile
```

## Phase D — Lost & Found

```text
Lost Post
Found Post
Post Images
Resolve Case
Nearby Feed
```

## Phase E — Location

```text
Location Permission
Map
Nearby API
Radius
Distance
PostGIS
```

## Phase F — Community

```text
Sighting
Follow Lost Case
Notification
Social Share
```

## Phase G — Communication

```text
Conversation
Message
WebSocket
Push Chat Notification
```

## Phase H — Safety

```text
Report
Block
Moderation
Admin
Rate Limit
Audit Log
```

## Phase I — Monetization

```text
Ads
Sponsored Posts
Impressions
Clicks
Admin Ads
```

---

# 81. Development Rules for Cursor

Cursor ต้องยึดเอกสารนี้เป็น Source of Truth

ห้าม:

```text
เปลี่ยน Tech Stack เอง
เพิ่ม Expo
เปลี่ยน FastAPI เป็น Framework อื่น
เปลี่ยน PostgreSQL เป็น Firebase
เปลี่ยน Architecture โดยไม่มีเหตุผล
สร้าง Feature นอก Scope
Refactor Code ที่ไม่เกี่ยวข้องโดยไม่จำเป็น
ทำ Browser Automation
เปิด Emulator เองโดยไม่ได้สั่ง
ทำ Autonomous Loop
```

---

# 82. Token Efficient Cursor Workflow

อย่าสั่ง:

```text
Build entire application from this spec.
```

ให้ทำทีละ Module

ตัวอย่าง:

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md.

Implement Phase A only.

Do not implement later phases.
Do not use Expo.
Do not open browser or emulator.
Do not modify unrelated files.

After implementation, return:
1. Files changed
2. Important decisions
3. Commands I need to run
4. Remaining work
```

---

# 83. Cursor Initial Prompt

ใช้ Prompt นี้หลังจากวางไฟล์ลง Repository:

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md and treat it as the project's source of truth.

Tech stack is fixed:

Mobile:
- React Native CLI
- TypeScript
- NO Expo and NO Expo packages

Backend:
- Python
- FastAPI
- SQLAlchemy 2.x
- Pydantic v2
- PostgreSQL
- Alembic
- Redis

Rules:
- Do not change the stack.
- Do not implement the entire project at once.
- Do not use browser automation.
- Do not launch Android/iOS emulators unless explicitly requested.
- Do not make unrelated changes.
- Keep code modular and production-oriented.
- Use /api/v1 for backend APIs.
- Follow the database and API conventions in the specification.

Start with Phase A only:
1. Monorepo structure
2. React Native CLI app structure
3. FastAPI structure
4. Docker Compose for backend/PostgreSQL/Redis
5. SQLAlchemy database setup
6. Alembic setup
7. React Native navigation
8. Theme/design tokens
9. Axios API client
10. Environment configuration

At the end, summarize:
- Files created
- Files changed
- Commands to run
- What is ready
- What remains for Phase B

Do not continue to Phase B until explicitly requested.
```

---

# 84. Cursor Phase B Prompt

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md.

Implement Phase B: Authentication only.

Backend:
- User model
- Register
- Login
- JWT access token
- Refresh token
- Logout
- /users/me
- Alembic migration

Mobile:
- Login screen
- Register screen
- Auth store
- Secure token storage using react-native-keychain
- Axios token interceptor
- Refresh token handling
- Auth navigation

Do not implement pets yet.
Do not use Expo.
Do not open emulator/browser.
Do not modify unrelated code.

Return:
- Files changed
- API endpoints implemented
- Database migration
- Commands to run
- Known TODOs
```

---

# 85. Cursor Phase C Prompt

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md.

Implement Phase C: Pet Profile + Pet QR only.

Backend:
- pets table
- pet_images table
- Pet CRUD
- ownership authorization
- pet_code
- secure qr_token
- public QR lookup endpoint

Mobile:
- My Pets screen
- Create Pet
- Edit Pet
- Pet Detail
- QR Code screen
- QR Scanner
- Public Pet Profile

Do not implement Lost/Found yet.
Do not use Expo.
Do not open emulator/browser.
Do not make unrelated changes.
```

---

# 86. Cursor Phase D Prompt

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md.

Implement Phase D: Lost & Found.

Implement:
- Lost Post
- Found Post
- Post images
- Resolve case
- Mark pet lost
- Restore pet status after resolved
- Lost/Found feed
- Mobile screens

Do not implement AI matching.
Do not implement Health.
Do not use Expo.
Do not open emulator/browser.
```

---

# 87. Cursor Phase E Prompt

```text
Read docs/PET_APP_DEVELOPMENT_SPEC.md.

Implement Phase E: Location + Map.

Implement:
- Native location permissions
- react-native-maps
- Nearby API
- radius search
- PostGIS support
- lost/found map pins
- filters
- distance display

No Expo packages.
Do not launch emulator/browser.
Do not modify unrelated modules.
```

---

# 88. Definition of Done

แต่ละ Module ถือว่าเสร็จเมื่อ:

```text
Code compiles
TypeScript has no relevant errors
FastAPI imports correctly
Alembic migration exists where required
Input validation exists
Authorization exists
API response format follows spec
Error codes follow spec
No Expo packages
No secrets committed
No unrelated changes
```

---

# 89. Testing Strategy

Backend:

```text
pytest
pytest-asyncio
httpx
```

Test อย่างน้อย:

```text
Authentication
Authorization
Pet CRUD
Lost Post
Found Post
Sighting
Nearby
Chat permissions
```

Mobile:

```text
Jest
React Native Testing Library
```

ไม่จำเป็นต้องทำ UI Automation ในช่วงแรก

---

# 90. Final Technical Decisions

ล็อก Stack:

```text
React Native CLI
TypeScript

FastAPI
Python

PostgreSQL
PostGIS

SQLAlchemy 2.x
Alembic

Redis

Cloudflare R2 / S3 Compatible

Firebase Cloud Messaging
APNs

FastAPI WebSocket
```

ห้าม Expo

---

# 91. Product Principle

ทุกการพัฒนาต้องให้ความสำคัญกับ:

```text
1. ตามหาสัตว์ได้เร็ว
2. แจ้งข้อมูลได้ง่าย
3. Location มีประโยชน์จริง
4. Privacy ของเจ้าของสัตว์
5. ติดต่อเจ้าของได้โดยไม่เปิดข้อมูลส่วนตัวเกินจำเป็น
6. UI เป็นมิตร
7. ไม่ทำ Flow ซับซ้อน
```

Critical Flow ต้องสั้นที่สุด:

```text
Pet Lost
= Select Pet → Location → Publish

Pet Found
= Photo → Location → Publish

Sighting
= Location → Time → Submit
```

---

# 92. Source of Truth Priority

หากมี Conflict ระหว่าง Code และเอกสาร:

```text
1. PET_APP_DEVELOPMENT_SPEC.md
2. pet_app_product_ui_spec.md
3. Existing implementation
```

ยกเว้น Developer/User สั่งเปลี่ยน Requirement ใหม่โดยตรง

---

# End of Specification
