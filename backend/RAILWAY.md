# Railway deploy notes for PetApp backend

## Live (production)

- Project: `petapp-api`
- API: https://api-production-6009.up.railway.app
- Health: https://api-production-6009.up.railway.app/health
- Docs: https://api-production-6009.up.railway.app/docs
- Mobile `API_BASE_URL`: `https://api-production-6009.up.railway.app/api/v1`

Demo accounts (password `Demo123!`): `admin@example.com`, `demo@example.com`, …

## Redeploy

```bash
cd backend
railway up --service api -d
```

Seed / reseed (needs Postgres TCP proxy or SSH):

```bash
DATABASE_URL='postgresql+psycopg://…@<proxy-host>:<port>/railway' python -m app.seed
```

## Variables (api service)

| Key | Notes |
|-----|--------|
| `SECRET_KEY` | random hex |
| `APP_ENV` | `production` |
| `CORS_ORIGINS` | `*` |
| `PUBLIC_API_BASE` | https://api-production-6009.up.railway.app |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

Optional S3/R2: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE=true`.

Without S3, uploads use ephemeral disk under `/data/uploads` (add a volume or S3 for persistence).
