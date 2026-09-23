# Pet App — Product, UX/UI & Development Specification

> เอกสารสำหรับใช้เป็น Master Specification เพื่อออกแบบและพัฒนาแอปสำหรับเจ้าของสัตว์เลี้ยง โดยเน้น **Digital Pet ID + Lost & Found + Nearby Community + Social Sharing + Ads + Pet Care**

---

## 1. Product Vision

สร้างแอปที่เป็นศูนย์กลางประจำตัวสัตว์เลี้ยงและชุมชนช่วยเหลือสัตว์ โดยผู้ใช้สามารถ:

- ลงทะเบียนหมา แมว และสัตว์เลี้ยง
- มี Digital Pet ID และ QR Code ประจำตัว
- แจ้งสัตว์หายได้ภายในไม่กี่ขั้นตอน
- แจ้งพบสัตว์ / ส่งเบาะแสตำแหน่ง
- เห็นสัตว์หายหรือสัตว์ที่ถูกพบในบริเวณใกล้เคียง
- แชร์ประกาศออกไปยัง Social Media ได้ง่าย
- ติดต่อเจ้าของหรือผู้พบผ่านระบบโดยไม่จำเป็นต้องเปิดเผยเบอร์โทร
- เก็บข้อมูลสุขภาพและการดูแลสัตว์
- รองรับพื้นที่โฆษณาแบบไม่รบกวนผู้ใช้งาน

แนวคิดหลักของ Product:

**Pet Identity + Safety + Community + Location + Care**

---

# 2. Product Principles

## 2.1 ใช้งานง่ายในเวลาฉุกเฉิน

กรณีสัตว์หาย ผู้ใช้ต้องสามารถสร้างประกาศได้เร็วที่สุด

ตัวอย่าง Flow:

`My Pets → เลือกสัตว์ → แจ้งหาย → ระบุตำแหน่ง → Publish`

ไม่ควรบังคับให้เจ้าของกรอกข้อมูลสัตว์ใหม่ หากข้อมูลนั้นมีอยู่แล้วใน Pet Profile

## 2.2 Privacy First

ข้อมูลเจ้าของไม่ควรถูกเปิดเผยโดยอัตโนมัติ

ควรใช้:

- In-app Chat
- Contact Request
- Relay Contact
- ข้อมูลที่เจ้าของเลือกเปิดเผยเอง

## 2.3 Friendly & Warm

UI ต้องให้ความรู้สึก:

- เป็นมิตร
- อบอุ่น
- ปลอดภัย
- สนุกเล็กน้อย
- ไม่ดูเป็นระบบราชการ
- ไม่ดูเป็น Hospital UI จนเกินไป

## 2.4 Community Driven

ระบบควรออกแบบให้ผู้ใช้รู้สึกว่าสามารถช่วยสัตว์ตัวอื่นได้ แม้ไม่ใช่สัตว์ของตนเอง

---

# 3. User Roles

## 3.1 Guest

สามารถ:

- เปิดหน้า Public Pet Profile ผ่าน QR
- ดู Lost / Found Post ที่อนุญาตให้ Public
- ดูข้อมูลพื้นฐานของสัตว์
- แจ้งว่าพบสัตว์
- เปิด Share Link

## 3.2 Registered User

สามารถ:

- สร้าง Pet Profile
- สร้าง Lost Post
- สร้าง Found Post
- แจ้ง Sighting
- Chat
- Follow Case
- แชร์โพสต์
- บันทึก Pet Health
- จัดการ Guardian
- จัดการ Notification

## 3.3 Pet Owner

ผู้ใช้ที่เป็นเจ้าของ Pet Profile

สิทธิ์เพิ่มเติม:

- เปลี่ยนสถานะสัตว์
- ตั้งค่า Public / Private
- Mark as Lost
- Mark as Found
- จัดการ Guardian
- ยืนยันความเป็นเจ้าของ
- ปิด Case

## 3.4 Guardian

ผู้ดูแลร่วม เช่น:

- คนในครอบครัว
- แฟน
- พี่เลี้ยงสัตว์

สามารถกำหนด Permission ได้ เช่น:

- View only
- Edit Pet
- Manage Lost Case
- Receive Alert

## 3.5 Admin

สามารถ:

- จัดการ User
- จัดการ Pet
- จัดการ Lost / Found / Sighting
- ตรวจสอบ Report
- Suspend User
- จัดการ Ads
- ดู Analytics
- จัดการ Content / Category / System Setting

---

# 4. Core Modules

## 4.1 Authentication

รองรับ:

- Email + Password
- Phone + OTP
- Google
- Apple Sign In

Optional:

- Facebook Login
- LINE Login

### Account Fields

- user_id
- display_name
- avatar
- email
- phone
- status
- language
- timezone
- created_at

---

# 5. Pet Profile / Digital Pet ID

ผู้ใช้สามารถลงทะเบียนสัตว์หลายตัวในบัญชีเดียว

## 5.1 Pet Information

- Pet ID
- QR Code
- ชื่อ
- รูป Profile
- Gallery
- ประเภทสัตว์
- สายพันธุ์
- เพศ
- สี
- วันเกิด / อายุโดยประมาณ
- น้ำหนัก
- ทำหมันแล้วหรือไม่
- Microchip ID
- ลักษณะเด่น
- ตำหนิ
- นิสัย
- อาหารที่แพ้
- ยาที่แพ้
- โรคประจำตัว
- Emergency Note
- Owner
- Guardian
- Status

### Pet Status

- Normal
- Lost
- Found
- In Treatment
- Deceased
- Archived

---

# 6. QR Code / Pet ID

สัตว์แต่ละตัวต้องมี QR Code เฉพาะตัว

## 6.1 เมื่อ Scan QR

เปิดหน้า Public Pet Profile

แสดงเฉพาะข้อมูลที่เจ้าของอนุญาต เช่น:

- รูปสัตว์
- ชื่อ
- สายพันธุ์
- สี
- ลักษณะเฉพาะ
- Emergency Info
- Lost Status

CTA หลัก:

- **ฉันพบสัตว์ตัวนี้**
- **ส่งตำแหน่งให้เจ้าของ**
- **ติดต่อเจ้าของ**

## 6.2 Privacy

Default ไม่ควรแสดง:

- เบอร์โทร
- Email
- ที่อยู่เจ้าของ
- ข้อมูลส่วนตัวละเอียด

---

# 7. Lost Pet

## 7.1 Create Lost Case

Flow:

`My Pets → Pet Detail → แจ้งหาย`

ระบบ Auto Fill:

- รูปสัตว์
- ชื่อ
- สายพันธุ์
- สี
- เพศ
- ลักษณะเด่น

เจ้าของเพิ่ม:

- จุดที่หาย
- วันที่ / เวลา
- รายละเอียดล่าสุด
- รูปล่าสุด
- รางวัลนำส่ง
- Contact Preference
- Notification Radius

## 7.2 Notification Radius

ตัวเลือก:

- 1 km
- 3 km
- 5 km
- 10 km
- 20 km
- Custom

## 7.3 Lost Case Status

- Active
- Possible Match
- Sighting Received
- Found
- Closed
- Cancelled

---

# 8. Found Pet

สำหรับผู้ใช้ที่พบสัตว์แต่ไม่รู้ว่าเป็นของใคร

## Flow

`Home → พบสัตว์ → ถ่ายรูป → Location → Details → Publish`

ข้อมูล:

- รูป
- ประเภทสัตว์
- สี
- สายพันธุ์โดยประมาณ
- จุดที่พบ
- วันที่ / เวลา
- มีปลอกคอหรือไม่
- มี Tag / QR หรือไม่
- สภาพสัตว์
- ผู้พบสามารถดูแลไว้หรือไม่
- รายละเอียดเพิ่มเติม

ระบบควรค้นหา Lost Case ที่อาจตรงกัน

---

# 9. Sighting Report

Sighting คือกรณีที่ผู้ใช้ "เห็น" สัตว์คล้ายกับตัวที่กำลังถูกตามหา แต่ไม่ได้จับไว้

## Data

- Case ID
- Location
- Time
- Photo / Video
- Direction
- Note
- Reporter

## CTA

- **ฉันเห็นสัตว์ตัวนี้**

## Owner View

แสดงเป็น Timeline เช่น:

`บ้าน → ซอย A → ร้านสะดวกซื้อ → จุดล่าสุด`

และแสดงบน Map

---

# 10. Nearby Lost & Found

หน้า Explore / Nearby เป็นหัวใจของ Community

## Feed

Card แสดง:

- รูปสัตว์
- Lost / Found Badge
- ชื่อ
- ระยะทาง
- จุดพบล่าสุด
- เวลา
- CTA

## Filters

- Lost
- Found
- Dog
- Cat
- Other
- Distance
- Date
- Has Reward
- Recently Updated

---

# 11. Map

Map แสดง:

- Lost Case
- Found Pet
- Sighting

Pin สีควรแยกสถานะชัดเจน

ตัวอย่าง:

- Lost = Coral / Red
- Found = Green
- Sighting = Amber

เมื่อกด Pin:

แสดง Bottom Sheet:

- รูป
- ชื่อ
- สถานะ
- เวลา
- Distance
- View Case

---

# 12. Lost Pet Alert

ผู้ใช้สามารถกด:

**ช่วยตามหา**

ระบบจะ Follow Case

จากนั้นสามารถได้รับ Notification เมื่อ:

- มี Sighting ใหม่
- มี Found Post ที่อาจ Match
- เจ้าของ Update Case
- Case ปิดแล้ว

---

# 13. Matching Engine

## Phase 1 — Rule Based

เทียบจาก:

- ประเภทสัตว์
- สี
- สายพันธุ์
- เพศ
- Location
- Distance
- วันที่
- เวลา
- ลักษณะเด่น

## Phase 2 — AI Matching

ใช้ Image Similarity / Vision Model เปรียบเทียบ:

- ลาย
- สี
- ใบหน้า
- รูปร่าง
- ตำหนิ

แสดงเป็น:

**Possible Match**

ไม่ควรใช้ข้อความที่ฟันธงว่าเป็นสัตว์ตัวเดียวกัน

ตัวอย่าง:

`Possible Match — High Similarity`

---

# 14. Social Sharing

รองรับ:

- Facebook
- LINE
- Instagram
- X
- Messenger
- Copy Link
- Native Share Sheet

## Auto-generated Share Card

รูปแบบ:

- รูปสัตว์
- LOST / FOUND Label
- ชื่อ
- สี / สายพันธุ์
- จุดล่าสุด
- วันที่
- QR Code
- Deep Link

ตัวอย่างข้อความ:

> ตามหา Momo
> แมวสีขาวส้ม
> พบล่าสุดบริเวณรัชดา
> หากพบสามารถแจ้งเบาะแสผ่านแอปได้ทันที

---

# 15. In-App Chat

รองรับ:

- Owner ↔ Finder
- Owner ↔ Sighting Reporter

Features:

- Text
- Image
- Location
- Quick Reply
- Block
- Report

Privacy:

ไม่เปิดเผยเบอร์โทรโดย Default

---

# 16. Ownership Verification

ข้อมูลบางส่วนควรเก็บเป็น Private Verification เช่น:

- Microchip
- รูปเก่า
- ตำหนิที่ไม่แสดง Public
- ประวัติ Vet
- เอกสารเจ้าของ

ใช้เพื่อช่วยยืนยันว่าใครคือเจ้าของจริง

---

# 17. Pet Guardian

เจ้าของสามารถเพิ่ม Guardian ได้หลายคน

Fields:

- User
- Relationship
- Permission
- Receive Notification

Permission:

- View Pet
- Edit Pet
- Manage Lost Case
- View Health
- Receive Alerts

---

# 18. Health & Care

## Health Profile

เก็บ:

- Vaccine
- Vaccine Expiry
- Deworming
- Flea / Tick Treatment
- Medical Condition
- Allergy
- Medication
- Weight History
- Vet Visit
- Note

## Reminder

เช่น:

- Vaccine Due
- Medication
- Vet Appointment
- Grooming

---

# 19. Emergency Information

เจ้าของกำหนดข้อมูลที่แสดงหลัง Scan QR ได้

เช่น:

- โรคประจำตัว
- แพ้อาหาร
- แพ้ยา
- ห้ามให้อาหารบางชนิด
- ต้องกินยา
- กลัวคน
- อาจกัด

---

# 20. Notification System

Notification Types:

- Lost Pet Nearby
- New Sighting
- Possible Match
- QR Scanned
- Finder Contact
- New Chat
- Case Updated
- Case Closed
- Health Reminder
- Guardian Invite
- Promotion / Ads

ผู้ใช้สามารถเปิด/ปิดแต่ละประเภทได้

---

# 21. Ads & Monetization

## 21.1 Native Ads

พื้นที่แนะนำ:

- Home Feed
- Nearby Feed
- Explore
- Pet Care

รูปแบบ:

`Sponsored`

ไม่ควรแทรก Ads ระหว่าง Emergency Flow

## 21.2 Advertiser Types

- Pet Shop
- Vet / Animal Hospital
- Grooming
- Pet Hotel
- Pet Food
- Insurance
- GPS Tracker
- Pet Training
- Pet Transportation

## 21.3 Boost Lost Post

Optional Revenue Feature

เจ้าของสามารถ Boost ประกาศให้ Reach กว้างขึ้น

ตัวเลือกเช่น:

- 3 km
- 5 km
- 10 km
- 20 km

ต้องแยกให้ชัดเจนว่าเป็น Paid Boost แต่ไม่ทำให้ Organic Emergency Post หายไป

---

# 22. Admin Dashboard

Modules:

## Dashboard

- Total Users
- Active Users
- Total Pets
- Lost Cases
- Found Cases
- Resolved Cases
- Active Ads
- Reports

## Users

- Search
- Suspend
- Ban
- View Activity

## Pets

- Search Pet ID
- View Owner
- View Case

## Lost & Found

- Moderate
- Remove
- Mark Suspicious

## Reports

- Scam
- Spam
- Abuse
- Fake Post
- Duplicate

## Ads

- Campaign
- Advertiser
- Placement
- Start / End Date
- Impression
- Click
- CTR

---

# 23. Main Navigation

แนะนำ Bottom Navigation 5 เมนู

1. Home
2. Nearby
3. Add / Report
4. My Pets
5. Profile

ปุ่มตรงกลาง **Add / Report** สามารถเด่นกว่าปุ่มอื่น

เมื่อกด:

- แจ้งสัตว์หาย
- พบสัตว์
- แจ้งเบาะแส

---

# 24. Screen List

## Onboarding

- Splash
- Welcome
- Permission Explanation
- Login
- Register
- OTP

## Home

- Greeting
- Search
- Nearby Alerts
- Lost Near You
- Found Near You
- Quick Actions
- Tips
- Native Ads

## My Pets

- Pet List
- Add Pet
- Pet Detail
- Edit Pet
- QR Code
- Guardians
- Health
- Documents

## Lost & Found

- Lost Feed
- Found Feed
- Case Detail
- Create Lost
- Create Found
- Create Sighting
- Case Timeline
- Case Map

## Nearby

- Map
- List
- Filters
- Distance Selector

## Chat

- Chat List
- Chat Room

## Profile

- Account
- Privacy
- Notifications
- Language
- Blocked Users
- Help
- Terms
- Logout

---

# 25. UX/UI Direction

## 25.1 Mood

UI ต้องมี Character:

- Friendly
- Soft
- Playful
- Trustworthy
- Clean
- Modern
- Human

หลีกเลี่ยง:

- สี Neon มากเกินไป
- สีแดงจัดทั้งระบบ
- Gradient เยอะจนอ่านยาก
- Card ที่มี Shadow หนัก
- Interface แบบ Corporate Dashboard

---

# 26. Color Palette

## Primary — Warm Teal

`#2FA89A`

ใช้กับ:

- Primary Button
- Selected Navigation
- Active State
- Main CTA

ให้ความรู้สึกสงบ ปลอดภัย และเป็นมิตร

## Primary Dark

`#237D73`

ใช้กับ:

- Pressed State
- Heading Accent

## Secondary — Soft Peach

`#FFB38A`

ใช้กับ:

- Highlight
- Pet Card Accent
- Friendly UI Element

## Accent — Sunny Yellow

`#FFD166`

ใช้กับ:

- Badge
- Reward
- Tips
- Sighting

## Background

`#FFF9F4`

Warm Off-white

## Surface

`#FFFFFF`

## Text Primary

`#263238`

## Text Secondary

`#66727A`

## Border

`#E9E1DA`

## Success

`#4DBA87`

## Warning

`#F4A340`

## Lost / Critical

`#F2645A`

ใช้เฉพาะสถานะ Lost / Emergency

## Found

`#48A878`

---

# 27. Suggested Dark Mode

Background:

`#17201F`

Surface:

`#202B29`

Card:

`#263330`

Primary:

`#56C5B7`

Text:

`#F6F8F7`

Secondary Text:

`#B9C6C3`

---

# 28. Typography

ภาษาไทยแนะนำ:

- Noto Sans Thai
- LINE Seed Sans TH
- IBM Plex Sans Thai

Font Style:

- Heading: 700
- Subheading: 600
- Body: 400 / 500

Mobile Size Guide:

- Display: 28–32
- H1: 24
- H2: 20
- H3: 18
- Body: 16
- Small: 14
- Caption: 12

---

# 29. Radius & Shape

เพื่อให้ UI ดูเป็นมิตร:

- Small Control: 10px
- Button: 14px
- Card: 18px
- Modal: 24px
- Pet Image: 18–24px

ใช้ทรงโค้งมนมากกว่ามุมแข็ง

---

# 30. Shadows

ใช้ Shadow แบบ Soft

Example:

```css
box-shadow: 0 6px 24px rgba(40, 55, 50, 0.08);
```

ไม่ควรใช้ Shadow เข้ม

---

# 31. Icon Style

ใช้ Icon:

- Rounded
- Stroke 1.8–2px
- Friendly
- Simple

Icon สำคัญ:

- Paw
- Dog
- Cat
- QR
- Map Pin
- Bell
- Heart
- Message
- Share
- Eye
- Medical

---

# 32. Illustration Style

สามารถใช้ Illustration เล็กน้อย เช่น:

- หมา / แมวโทน Pastel
- Paw Pattern
- Bone / Yarn / Ball
- House
- Heart

แต่ไม่ควรทำให้ UI ดูเด็กเกินไป

เป้าหมายคือ:

**Cute แต่ยัง Professional**

---

# 33. Home UI Layout

```text
┌─────────────────────────────┐
│ สวัสดี 👋                   │
│ วันนี้น้องๆ เป็นยังไงบ้าง    │
│                             │
│ [ 🔎 Search ]               │
│                             │
│ ┌─────────────────────────┐ │
│ │ ⚠️ Lost Alert Nearby    │ │
│ │ มีสัตว์หายใกล้คุณ 3 ตัว │ │
│ └─────────────────────────┘ │
│                             │
│ Quick Actions               │
│ [แจ้งหาย] [พบสัตว์] [Scan] │
│                             │
│ ใกล้คุณ                     │
│ [ Pet Card ] [ Pet Card ]   │
│                             │
│ Sponsored                   │
│ [ Native Ad ]               │
└─────────────────────────────┘
```

---

# 34. Pet Card

Card ควรมี:

- รูปใหญ่
- ชื่อ
- Species / Breed
- Status
- Distance ถ้าเป็น Lost/Found
- Quick CTA

Example:

```text
┌─────────────────────────┐
│      [ Pet Photo ]       │
│                         │
│ Momo       🔴 LOST       │
│ British Shorthair       │
│ 📍 1.2 km               │
│                         │
│ [ดูรายละเอียด]          │
└─────────────────────────┘
```

---

# 35. Lost Case UI

Header:

- Large Pet Photo
- LOST Badge
- Name
- Last Seen

Action Buttons:

- แจ้งเบาะแส
- แชร์
- ช่วยตามหา

Sections:

- Last Seen
- Description
- Characteristics
- Reward
- Timeline
- Map

---

# 36. Empty States

ต้องมี Empty State ที่เป็นมิตร

ตัวอย่าง My Pets:

> ยังไม่มีน้องในบ้านนี้ 🐾
>
> เพิ่มสัตว์เลี้ยงตัวแรก เพื่อสร้าง Pet ID และ QR ประจำตัว

CTA:

**เพิ่มสัตว์เลี้ยง**

---

# 37. Error States

ใช้ภาษาที่เป็นมิตร

แทนที่จะเขียน:

`Error 500`

ใช้:

> มีบางอย่างไม่สำเร็จ
>
> ลองใหม่อีกครั้ง หรือกลับมาภายหลัง

สำหรับ Network:

> อินเทอร์เน็ตขาดการเชื่อมต่อ
>
> ข้อมูลที่กรอกไว้จะยังไม่หาย

---

# 38. Accessibility

ต้องรองรับ:

- Text Contrast
- Dynamic Font
- Screen Reader
- Large Tap Target
- Minimum Touch Area 44x44
- Icon + Text ใน Critical Action

ไม่ควรใช้สีเพียงอย่างเดียวในการบอกสถานะ

---

# 39. Database Model

## users

- id
- display_name
- email
- phone
- avatar_url
- status
- created_at
- updated_at

## pets

- id
- owner_id
- pet_code
- name
- species
- breed
- gender
- color
- birth_date
- weight
- microchip_id
- description
- distinctive_marks
- emergency_note
- status
- profile_image
- created_at

## pet_guardians

- id
- pet_id
- user_id
- permission
- notification_enabled

## lost_cases

- id
- pet_id
- owner_id
- status
- last_seen_lat
- last_seen_lng
- last_seen_address
- last_seen_at
- description
- reward_amount
- radius_km
- created_at
- resolved_at

## found_posts

- id
- user_id
- species
- breed
- color
- gender
- lat
- lng
- address
- found_at
- description
- image_url
- status

## sightings

- id
- lost_case_id
- reporter_id
- lat
- lng
- address
- sighted_at
- direction
- note
- image_url

## chats

- id
- type
- related_case_id
- created_at

## chat_members

- chat_id
- user_id

## messages

- id
- chat_id
- sender_id
- type
- body
- attachment_url
- created_at

## health_records

- id
- pet_id
- type
- title
- detail
- date
- due_date
- attachment_url

## notifications

- id
- user_id
- type
- title
- body
- data_json
- read_at
- created_at

## ads

- id
- advertiser_id
- campaign_name
- placement
- image_url
- destination_url
- start_at
- end_at
- status

## reports

- id
- reporter_id
- target_type
- target_id
- reason
- detail
- status

---

# 40. API Guidelines

Base:

`/api/v1`

## Authentication

```http
POST /auth/register
POST /auth/login
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/refresh
POST /auth/logout
```

## Pets

```http
GET    /pets
POST   /pets
GET    /pets/:id
PATCH  /pets/:id
DELETE /pets/:id
GET    /pets/:id/qr
```

## Guardians

```http
GET    /pets/:id/guardians
POST   /pets/:id/guardians
PATCH  /pets/:id/guardians/:guardianId
DELETE /pets/:id/guardians/:guardianId
```

## Lost

```http
GET    /lost
POST   /lost
GET    /lost/:id
PATCH  /lost/:id
POST   /lost/:id/close
POST   /lost/:id/follow
DELETE /lost/:id/follow
```

## Found

```http
GET    /found
POST   /found
GET    /found/:id
PATCH  /found/:id
```

## Sighting

```http
GET  /lost/:id/sightings
POST /lost/:id/sightings
```

## Nearby

```http
GET /nearby?lat=&lng=&radius=&type=
```

## Matching

```http
GET /lost/:id/matches
GET /found/:id/matches
```

## Chat

```http
GET  /chats
POST /chats
GET  /chats/:id/messages
POST /chats/:id/messages
```

## Health

```http
GET    /pets/:id/health
POST   /pets/:id/health
PATCH  /pets/:id/health/:recordId
DELETE /pets/:id/health/:recordId
```

## Ads

```http
GET /ads?placement=home
POST /ads/:id/impression
POST /ads/:id/click
```

---

# 41. HTTP Status Standard

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
429 Too Many Requests
500 Internal Server Error
```

Error Format:

```json
{
  "error": {
    "code": "PET_NOT_FOUND",
    "message": "Pet not found",
    "details": null
  }
}
```

---

# 42. Location & Privacy

Location ต้องขอ Permission แบบอธิบายเหตุผลก่อน

เช่น:

> แอปใช้ตำแหน่งเพื่อแสดงสัตว์ที่หายหรือถูกพบใกล้คุณ

ไม่ควรติดตาม Background Location โดยไม่จำเป็น

สำหรับ Lost Case สามารถลด Precision ของ Public Map ได้ เพื่อไม่เปิดเผยจุดส่วนตัวมากเกินไป

---

# 43. Security

ต้องมี:

- Access Token
- Refresh Token
- Rate Limit
- Device Session
- Input Validation
- File Type Validation
- Image Malware Scan หรือ Safe Upload Pipeline
- Report / Block
- Audit Log สำหรับ Admin

ข้อมูล Health และ Verification ต้องมี Access Control ชัดเจน

---

# 44. Push Notification

รองรับ:

- iOS APNs
- Android FCM

Geographic Notification Logic:

เมื่อมี Lost Case ใหม่:

1. รับ lat/lng
2. หา User ที่เปิด Nearby Alert
3. Filter ตาม Radius
4. ส่ง Push

ต้องมี Rate Limit ป้องกัน Spam

---

# 45. Search

Search ได้จาก:

- Pet ID
- Pet Name
- QR
- Species
- Breed
- Location
- Case ID

---

# 46. Analytics Events

ตัวอย่าง Event:

- signup_completed
- pet_created
- qr_scanned
- lost_case_created
- found_post_created
- sighting_created
- lost_case_shared
- lost_case_followed
- possible_match_opened
- chat_started
- case_resolved
- ad_impression
- ad_click

---

# 47. MVP Scope

## Must Have

- Auth
- User Profile
- Pet Profile
- Digital Pet ID
- QR Code
- Public Pet Page
- Lost Post
- Found Post
- Sighting
- Nearby Feed
- Nearby Map
- Push Notification
- Social Share
- Chat
- Follow Case
- Mark as Found
- Close Case
- Report / Block
- Ads Placement
- Admin Dashboard

---

# 48. Phase 2

- AI Image Matching
- Health Profile
- Vaccine Reminder
- Vet Appointment
- Guardian Advanced Permission
- Ownership Verification
- Boost Lost Post
- Ad Campaign Management
- Advanced Analytics

---

# 49. Phase 3

- GPS Tracker Integration
- Clinic / Hospital Integration
- Pet Insurance
- Marketplace
- Adoption / Rescue
- Shelter Account
- Vet Account
- Lost Pet Heatmap
- Community Group

---

# 50. Recommended App Architecture

```text
Mobile App
│
├── Authentication
├── Pet
├── Lost & Found
├── Nearby
├── Map
├── Chat
├── Health
└── Profile

API Gateway / Backend
│
├── Auth Service
├── Pet Service
├── Lost & Found Service
├── Matching Service
├── Geo Service
├── Notification Service
├── Chat Service
├── Ads Service
└── Admin Service

Data Layer
│
├── PostgreSQL
├── Redis
├── Object Storage
└── Search / Geo Index
```

---

# 51. Suggested Technology Stack

## Mobile

Recommended:

- React Native CLI
- TypeScript
- React Navigation
- TanStack Query
- Zustand
- React Hook Form
- Zod

## Backend

เลือกได้ตามทีม เช่น:

- Node.js + Fastify / NestJS
- Bun + Hono

## Database

- PostgreSQL
- PostGIS สำหรับ Geo Query

## Cache

- Redis

## File Storage

- S3 Compatible Storage
- Cloudflare R2

## Push

- Firebase Cloud Messaging
- APNs

## Map

- Google Maps
- Mapbox

---

# 52. Recommended Component System

Components:

- AppHeader
- BottomNavigation
- PetAvatar
- PetCard
- StatusBadge
- LostAlertCard
- FoundCard
- SightingCard
- DistanceChip
- FilterChip
- PrimaryButton
- SecondaryButton
- FloatingActionButton
- EmptyState
- ConfirmSheet
- MapBottomSheet
- ShareSheet
- QRCard
- AdCard
- HealthCard
- GuardianCard

---

# 53. Design Tokens

```ts
export const colors = {
  primary: '#2FA89A',
  primaryDark: '#237D73',
  secondary: '#FFB38A',
  accent: '#FFD166',
  background: '#FFF9F4',
  surface: '#FFFFFF',
  textPrimary: '#263238',
  textSecondary: '#66727A',
  border: '#E9E1DA',
  success: '#4DBA87',
  warning: '#F4A340',
  danger: '#F2645A',
  found: '#48A878',
}

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
}
```

---

# 54. Important UX Rules

1. Emergency Action ต้องกดถึงได้ภายใน 1–2 หน้าจอ
2. Lost Case ต้อง Auto-fill จาก Pet Profile
3. ห้ามบังคับกรอกข้อมูลที่ไม่จำเป็นก่อน Publish
4. ต้อง Save Draft อัตโนมัติ
5. Upload รูปแล้วต้อง Compress ก่อนส่ง
6. GPS Permission ต้องขอเมื่อจำเป็น
7. ต้องมี Report / Block ทุก User-generated Content
8. Ads ห้ามขวาง Emergency Flow
9. Chat ไม่เปิดเผยข้อมูลส่วนตัวโดย Default
10. ทุก Lost Case ต้อง Share ออก Social ได้
11. Lost Case ต้องมี Deep Link
12. ทุก Pet ต้องมี QR / Pet ID
13. Case ที่ปิดแล้วต้องยังเปิดดู History ได้
14. ใช้สีแดงเฉพาะ Critical / Lost เพื่อไม่ทำให้ UI ดูเครียด
15. UI หลักควรใช้ Warm Teal + Peach + Cream เป็นโทนหลัก

---

# 55. Product Success Metrics

ควรติดตาม:

- จำนวน Pet ที่ลงทะเบียน
- QR Scan / Pet
- Lost Case / Month
- Found Post / Month
- Sighting / Case
- Share / Lost Case
- Follow / Lost Case
- Match Rate
- Resolution Rate
- Median Time to First Sighting
- Median Time to Resolve
- DAU / MAU
- Ad CTR

Metric หลักที่สำคัญที่สุด:

**Resolved Lost Pet Cases**

เพราะเป็น Value หลักที่แอปสร้างให้ผู้ใช้

---

# 56. Final Product Direction

แอปนี้ไม่ควรถูกออกแบบเป็นเพียง "แอปประกาศหมาแมวหาย"

ควรเป็น:

> **Digital Identity & Safety Network for Pets**

แกน Product ประกอบด้วย:

**Pet Profile → QR Identity → Lost & Found → Nearby Community → Sighting → Matching → Social Sharing → Resolution → Ongoing Pet Care**

หากสร้างตามโครงสร้างนี้ แอปจะมีเหตุผลให้ผู้ใช้ติดตั้งและใช้งานแม้ในวันที่สัตว์ไม่ได้หาย และจะสามารถขยายไปสู่ Pet Care, Clinic, GPS Tracker, Insurance และ Marketplace ได้ในอนาคต

---

# 57. Agent / Development Instruction

ใช้เอกสารนี้เป็น Master Product Specification

ข้อกำหนดสำคัญ:

- ห้ามตัด Core Lost & Found Flow
- Mobile-first
- UI Friendly / Warm / Pet-friendly
- รองรับทั้ง Dog และ Cat ตั้งแต่แรก
- Architecture ต้องรองรับ Other Species ในอนาคต
- แยก Business Logic ออกจาก UI
- API ต้อง Versioned
- ทุก Geo Feature ต้องออกแบบด้าน Privacy
- ทุก User-generated Content ต้องมี Report / Moderation
- Emergency Flow ต้องเร็วกว่า Feature อื่นเสมอ

