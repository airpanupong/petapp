from fastapi import APIRouter

from app.api.v1 import (
    admin, ads, auth, chat, emergency, feed, found_posts, geo, guardians, health, lost_posts,
    moderation, nearby, notifications, pet_images, pets, sightings, uploads, users, verification,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(pets.router)
api_router.include_router(pet_images.router)
api_router.include_router(guardians.router)
api_router.include_router(health.router)
api_router.include_router(emergency.router)
api_router.include_router(verification.router)
api_router.include_router(lost_posts.router)
api_router.include_router(found_posts.router)
api_router.include_router(feed.router)
api_router.include_router(sightings.router)
api_router.include_router(nearby.router)
api_router.include_router(geo.router)
api_router.include_router(notifications.router)
api_router.include_router(ads.router)
api_router.include_router(chat.router)
api_router.include_router(uploads.router)
api_router.include_router(moderation.router)
api_router.include_router(admin.router)
