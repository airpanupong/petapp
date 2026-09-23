.PHONY: up down logs backend-test backend-dev mobile-native

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

backend-test:
	cd backend && DATABASE_URL=sqlite:///./test.db pytest -q

backend-dev:
	cd backend && DATABASE_URL=sqlite:///./petapp-dev.db uvicorn app.main:app --reload --port 8000

mobile-native:
	cd mobile && ./scripts/generate-native.sh
