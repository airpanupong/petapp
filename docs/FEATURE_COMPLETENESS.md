# PetApp Feature Completeness

This document maps the requested product features to concrete mobile screens and backend APIs.

| Feature | Mobile UI | Backend | Status |
|---|---|---|---|
| Pet Profile / Digital Pet ID | My Pets, Create Pet, Pet Detail, Edit Pet, Pet QR, QR Scanner, Public Pet Profile | `/pets`, `/public/pets/qr/*` | Complete core flow |
| Lost Pet | Report Lost, Lost Post Detail | `/lost-posts` | Complete core flow |
| Found Pet | Report Found, Found Post Detail, QR Found Alert | `/found-posts`, `/public/pets/qr/{token}/found-alert` | Complete core flow |
| Nearby Lost & Found Map | Nearby Map + Feed | `/nearby` | Complete core flow |
| Social Sharing | Share actions on QR, Lost and Found flows/details | public share token support | Complete core flow |
| Sighting Report | Sighting Screen + Lost Detail timeline | `/lost-posts/{id}/sightings` | Complete core flow |
| Lost Pet Alert | Lost Alert Settings, Notification Center, Follow Case | `/notification-preferences`, `/notifications`, `/me/location`, follow APIs | In-app complete; FCM/APNs transport needs credentials |
| Pet Ownership Verification | Ownership Verification Screen | `/pets/{id}/ownership-verification`, admin review API | Complete review workflow API + owner UI |
| Pet Health Profile | Health Profile + Vaccination UI | health/vaccination APIs | Complete core flow |
| Emergency Information | Emergency Info editor + Public QR display | emergency APIs + public QR payload | Complete core flow |
| Advertising | Home native ad + Sponsored Screen | `/ads`, impression/click tracking | Complete core flow |
| Pet Guardian | Guardian management screen | guardian CRUD API | Complete core flow |

## Mobile screens

1. Login
2. Register
3. Home
4. Nearby Map / Feed
5. Report Hub
6. My Pets
7. Profile
8. Create Pet
9. Edit Pet
10. Pet Detail
11. Pet QR
12. QR Scanner
13. Public Pet Profile
14. Pet Health / Vaccinations
15. Emergency Information
16. Pet Guardian
17. Ownership Verification
18. Report Lost
19. Lost Post Detail / Sighting Timeline
20. Report Found
21. Found Post Detail
22. Sighting Report
23. Notification Center
24. Lost Pet Alert Settings / Nearby Alerts
25. Sponsored Ads

## External services still requiring project credentials

The source includes app/backend flow and integration points, but production delivery needs credentials configured by the project owner:

- Google Maps SDK keys
- Firebase Cloud Messaging / Apple Push Notification Service credentials
- Cloudflare R2 or another S3-compatible storage account for production image uploads
- Production public web/share domain
- Android/iOS signing credentials

## Docker

- `/Dockerfile` — production FastAPI image from repository root
- `/backend/Dockerfile` — backend image used by Docker Compose
- `/mobile/Dockerfile` — development Metro container only
- `/docker-compose.yml` — backend + PostgreSQL + Redis

React Native native Android/iOS binaries are built using Gradle/Xcode rather than Docker.
