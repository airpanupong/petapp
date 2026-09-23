# PetApp — Full Feature MVP

Pet identity + lost & found community app for dogs, cats and other pets.

## Stack

- Mobile: **React Native CLI + TypeScript — NO EXPO**
- Backend: FastAPI + SQLAlchemy 2.x + Alembic
- Database: PostgreSQL
- Redis for cache/queue-ready infrastructure
- Native Maps + QR scanner

## Product features included

- Pet Profile / Digital Pet ID + secure QR
- Lost Pet
- Found Pet
- Nearby Lost & Found Map / Feed
- Social Sharing
- Sighting Report / timeline
- Lost Pet Alert / Notification Center / Follow Case
- Pet Ownership Verification
- Pet Health Profile / Vaccinations
- Emergency Information shown safely through Public Pet Profile
- Native advertising / Sponsored area / impression + click tracking
- Pet Guardian

See `docs/FEATURE_COMPLETENESS.md` for the complete screen/API mapping.

## Docker quick start

```bash
cp .env.example .env
# Change SECRET_KEY before production.
docker compose up -d --build
docker compose exec backend python -m app.seed
```

API:

```text
http://localhost:8000/docs
http://localhost:8000/health
```

Demo login:

```text
demo@example.com
Demo123!
```

## Backend tests

```bash
cd backend
pytest -q
```

The current package includes automated coverage for auth/token rotation and the full feature flow including Health, Emergency, Guardian, Ownership Verification, Lost Alerts, Sighting and QR-found notifications.

## React Native

Application TypeScript source is under `mobile/src`.

The build environment used to create this archive cannot reach npm, so fetch the official React Native CLI native shell once on your development machine:

```bash
cd mobile
./scripts/generate-native.sh
npm install
```

Then:

```bash
npm start
npm run android
```

On macOS for iOS:

```bash
cd ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

No Expo package is used.

## Dockerfiles

```text
/Dockerfile           Production FastAPI image from repository root
/backend/Dockerfile   Backend image used by docker-compose.yml
/mobile/Dockerfile    Metro development container (not an iOS/Android native build image)
```

Docker Compose starts:

```text
backend
postgres
redis
```

## Production credentials to configure

- Google Maps key
- Firebase FCM / Apple APNs
- Cloudflare R2 / S3-compatible object storage
- Public QR/share domain
- Android/iOS signing

The app remains runnable for core local flows without those external production credentials, except features that specifically depend on the external service.
