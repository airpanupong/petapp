from __future__ import annotations

import os
import secrets
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select, text

from app.core.database import Base, SessionLocal, engine
from app.core.security import generate_pet_code, generate_qr_token, hash_password
from app.models.community import Ad, Conversation, ConversationMember, Message
from app.models.features import (
    AdEvent,
    AppNotification,
    DeviceToken,
    LostCaseFollower,
    NotificationPreference,
    OwnershipVerification,
    PetEmergencyInfo,
    PetHealthProfile,
    UserLocation,
    Vaccination,
)
from app.models.lost_found import FoundPost, LostPost, Sighting
from app.models.pet import Pet, PetGuardian
from app.models.user import User

NOW = datetime.now(timezone.utc)
BANGKOK = [
    (13.7563, 100.5018, "Ratchada, Bangkok"),
    (13.7460, 100.5340, "Sukhumvit, Bangkok"),
    (13.7308, 100.5418, "Thonglor, Bangkok"),
    (13.7650, 100.5380, "Ari, Bangkok"),
    (13.7200, 100.5250, "Silom, Bangkok"),
    (13.7800, 100.5100, "Chatuchak, Bangkok"),
    (13.7400, 100.5600, "Rama 9, Bangkok"),
    (13.7550, 100.4900, "Bang Sue, Bangkok"),
]


def _reset_all(db) -> None:
    """Wipe demo tables for a clean full seed (SEED_RESET=1)."""
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(delete(table))
    db.commit()


def _user(db, email: str, name: str, phone: str | None = None, role: str = "user") -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            password_hash=hash_password("Demo123!"),
            display_name=name,
            phone=phone,
            status="active",
            role=role,
        )
        db.add(user)
        db.flush()
    else:
        if role == "admin" and user.role != "admin":
            user.role = "admin"
    return user


def _ensure_pref(db, user_id: str, radius: float = 5.0, animal: str = "all") -> None:
    if db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id)) is None:
        db.add(
            NotificationPreference(
                user_id=user_id,
                lost_alerts=True,
                radius_km=radius,
                animal_type=animal,
                chat_notifications=True,
                marketing_notifications=False,
            )
        )


def _ensure_location(db, user_id: str, lat: float, lng: float) -> None:
    row = db.scalar(select(UserLocation).where(UserLocation.user_id == user_id))
    if row is None:
        db.add(UserLocation(user_id=user_id, latitude=lat, longitude=lng))
    else:
        row.latitude = lat
        row.longitude = lng


def _pet(
    db,
    *,
    owner_id: str,
    name: str,
    animal_type: str,
    breed: str,
    gender: str,
    color: str,
    status: str,
    marks: str,
    microchip: str,
    note: str,
    image: str | None = None,
    weight: str = "4.5",
) -> Pet:
    pet = db.scalar(select(Pet).where(Pet.owner_id == owner_id, Pet.name == name))
    if pet is None:
        pet = Pet(
            owner_id=owner_id,
            pet_code=generate_pet_code(),
            qr_token=generate_qr_token(),
            name=name,
            animal_type=animal_type,
            breed=breed,
            gender=gender,
            color=color,
            birth_date=date(2022, 3, 15),
            weight=Decimal(weight),
            description=f"{name} is a demo {animal_type} for PetApp mock data.",
            distinctive_marks=marks,
            microchip_id=microchip,
            profile_image_url=image,
            emergency_note=note,
            status=status,
            is_public=True,
        )
        db.add(pet)
        db.flush()
    else:
        pet.status = status
    return pet


def _health(db, pet: Pet, allergies: str, meds: str, conditions: str) -> None:
    if db.scalar(select(PetHealthProfile).where(PetHealthProfile.pet_id == pet.id)) is None:
        db.add(
            PetHealthProfile(
                pet_id=pet.id,
                allergies=allergies,
                medications=meds,
                conditions=conditions,
                vet_name="Happy Paws Animal Clinic",
                vet_phone="02-111-2222",
                notes="Seeded demo health profile.",
            )
        )


def _vax(db, pet: Pet, rows: list[tuple[str, date, date | None]]) -> None:
    for name, given, due in rows:
        if db.scalar(select(Vaccination).where(Vaccination.pet_id == pet.id, Vaccination.name == name)) is None:
            db.add(
                Vaccination(
                    pet_id=pet.id,
                    name=name,
                    given_at=given,
                    next_due_at=due,
                    clinic_name="Happy Paws Animal Clinic",
                    note="Demo vaccination record",
                )
            )


def _emergency(db, pet: Pet, owner_name: str, phone: str) -> None:
    if db.scalar(select(PetEmergencyInfo).where(PetEmergencyInfo.pet_id == pet.id)) is None:
        db.add(
            PetEmergencyInfo(
                pet_id=pet.id,
                public_allergies="See health profile",
                public_medications=None,
                public_conditions="May panic around loud traffic",
                emergency_note=pet.emergency_note,
                emergency_contact_name=owner_name,
                emergency_contact_phone=phone,
                show_contact_phone=False,
            )
        )


def _lost(
    db,
    *,
    pet: Pet,
    owner_id: str,
    title: str,
    description: str,
    lat: float,
    lng: float,
    location: str,
    reward: bool = False,
    reward_text: str | None = None,
    hours_ago: int = 6,
) -> LostPost:
    existing = db.scalar(
        select(LostPost).where(LostPost.pet_id == pet.id, LostPost.title == title, LostPost.status == "active")
    )
    if existing:
        return existing
    post = LostPost(
        pet_id=pet.id,
        owner_id=owner_id,
        status="active",
        title=title,
        description=description,
        lost_at=NOW - timedelta(hours=hours_ago),
        latitude=lat,
        longitude=lng,
        location_text=location,
        search_radius_km=5,
        reward_enabled=reward,
        reward_text=reward_text,
        share_token=secrets.token_urlsafe(24),
    )
    db.add(post)
    db.flush()
    pet.status = "lost"
    return post


def _found(
    db,
    *,
    reporter_id: str,
    animal_type: str,
    breed: str,
    color: str,
    description: str,
    lat: float,
    lng: float,
    location: str,
    hours_ago: int = 3,
) -> FoundPost:
    existing = db.scalar(
        select(FoundPost).where(
            FoundPost.reporter_id == reporter_id,
            FoundPost.description == description,
            FoundPost.status == "active",
        )
    )
    if existing:
        return existing
    post = FoundPost(
        reporter_id=reporter_id,
        animal_type=animal_type,
        breed_guess=breed,
        color=color,
        description=description,
        image_url=None,
        found_at=NOW - timedelta(hours=hours_ago),
        latitude=lat,
        longitude=lng,
        location_text=location,
        status="active",
        share_token=secrets.token_urlsafe(24),
    )
    db.add(post)
    db.flush()
    return post


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if os.getenv("SEED_RESET", "").strip() in {"1", "true", "yes"}:
            _reset_all(db)

        owner = _user(db, "demo@example.com", "Demo User", "080-000-0001")
        guardian = _user(db, "guardian@example.com", "Family Guardian", "080-000-0002")
        finder = _user(db, "finder@example.com", "Kind Finder", "080-000-0003")
        neighbor = _user(db, "neighbor@example.com", "Nearby Neighbor", "080-000-0004")
        helper = _user(db, "helper@example.com", "Community Helper", "080-000-0005")
        admin = _user(db, "admin@example.com", "PetApp Admin", "080-000-0000", role="admin")
        _ = admin

        for u, lat, lng in [
            (owner, *BANGKOK[0][:2]),
            (guardian, *BANGKOK[1][:2]),
            (finder, *BANGKOK[2][:2]),
            (neighbor, *BANGKOK[3][:2]),
            (helper, *BANGKOK[4][:2]),
        ]:
            _ensure_pref(db, u.id, radius=8.0)
            _ensure_location(db, u.id, lat, lng)

        # --- Pets for demo owner ---
        momo = _pet(
            db,
            owner_id=owner.id,
            name="Momo",
            animal_type="cat",
            breed="Domestic Shorthair",
            gender="female",
            color="white-orange",
            status="lost",
            marks="Orange spot above left eye",
            microchip="TH-DEMO-MOMO-001",
            note="Friendly but may be scared. Please approach slowly.",
            weight="3.8",
        )
        bongo = _pet(
            db,
            owner_id=owner.id,
            name="Bongo",
            animal_type="dog",
            breed="Shiba Inu",
            gender="male",
            color="red-sesame",
            status="normal",
            marks="Curly tail, black collar",
            microchip="TH-DEMO-BONGO-002",
            note="Loves treats. Call if found.",
            weight="9.2",
        )
        nori = _pet(
            db,
            owner_id=owner.id,
            name="Nori",
            animal_type="cat",
            breed="Scottish Fold",
            gender="male",
            color="gray",
            status="normal",
            marks="Folded ears, blue harness tag",
            microchip="TH-DEMO-NORI-003",
            note="Indoor cat. Quiet personality.",
            weight="4.1",
        )

        # Neighbor's lost dog for map density
        toast = _pet(
            db,
            owner_id=neighbor.id,
            name="Toast",
            animal_type="dog",
            breed="Corgi",
            gender="female",
            color="tan-white",
            status="lost",
            marks="Short legs, pink bandana",
            microchip="TH-DEMO-TOAST-004",
            note="Very friendly. May follow strangers.",
            weight="11.0",
        )

        # Guardian link
        if db.scalar(select(PetGuardian).where(PetGuardian.pet_id == momo.id, PetGuardian.user_id == guardian.id)) is None:
            db.add(
                PetGuardian(
                    pet_id=momo.id,
                    user_id=guardian.id,
                    role="family",
                    can_edit=False,
                    can_mark_lost=True,
                    can_view_private_info=False,
                    can_receive_notifications=True,
                )
            )
        if db.scalar(select(PetGuardian).where(PetGuardian.pet_id == bongo.id, PetGuardian.user_id == guardian.id)) is None:
            db.add(
                PetGuardian(
                    pet_id=bongo.id,
                    user_id=guardian.id,
                    role="family",
                    can_edit=True,
                    can_mark_lost=True,
                    can_view_private_info=True,
                    can_receive_notifications=True,
                )
            )

        for pet, allergies, meds, conditions in [
            (momo, "Chicken", "None", "None"),
            (bongo, "None", "Heartworm prevention monthly", "Mild hip stiffness"),
            (nori, "Dairy", "None", "Sensitive stomach"),
            (toast, "None", "None", "None"),
        ]:
            _health(db, pet, allergies, meds, conditions)
            _emergency(db, pet, owner.display_name if pet.owner_id == owner.id else neighbor.display_name, "080-000-0001")
            _vax(
                db,
                pet,
                [
                    ("Rabies", date(2026, 6, 1), date(2027, 6, 1)),
                    ("DHPP" if pet.animal_type == "dog" else "FVRCP", date(2026, 5, 10), date(2027, 5, 10)),
                    ("Bordetella" if pet.animal_type == "dog" else "FeLV", date(2026, 4, 20), date(2027, 4, 20)),
                ],
            )

        if db.scalar(select(OwnershipVerification).where(OwnershipVerification.pet_id == momo.id)) is None:
            db.add(
                OwnershipVerification(
                    pet_id=momo.id,
                    owner_id=owner.id,
                    method="microchip",
                    evidence_note="Demo microchip certificate submitted for review",
                    status="pending",
                )
            )
        if db.scalar(select(OwnershipVerification).where(OwnershipVerification.pet_id == bongo.id)) is None:
            db.add(
                OwnershipVerification(
                    pet_id=bongo.id,
                    owner_id=owner.id,
                    method="document",
                    evidence_note="Adoption paperwork verified",
                    status="approved",
                    reviewer_note="Looks good",
                    reviewed_at=NOW - timedelta(days=2),
                )
            )

        # Lost posts
        momo_lost = _lost(
            db,
            pet=momo,
            owner_id=owner.id,
            title="ตามหา Momo",
            description="แมวบ้านสีขาวส้ม หลุดจากคอนโด ใส่ปลอกคอแดง",
            lat=BANGKOK[0][0],
            lng=BANGKOK[0][1],
            location=BANGKOK[0][2],
            reward=True,
            reward_text="มีรางวัลเล็กน้อยสำหรับผู้ช่วยเหลือ",
            hours_ago=8,
        )
        toast_lost = _lost(
            db,
            pet=toast,
            owner_id=neighbor.id,
            title="หาย Toast คอร์กี้",
            description="สุนัขคอร์กี้ใส่ผ้าโพกหัวชมพู หลุดใกล้สวนสาธารณะ",
            lat=BANGKOK[3][0],
            lng=BANGKOK[3][1],
            location=BANGKOK[3][2],
            reward=False,
            hours_ago=14,
        )

        # Extra nearby lost density: temporary pets owned by helper
        for idx, (name, animal, breed, color, loc) in enumerate(
            [
                ("Milo", "dog", "Pomeranian", "cream", BANGKOK[5]),
                ("Luna", "cat", "Persian", "white", BANGKOK[6]),
                ("Choco", "dog", "Beagle", "tri-color", BANGKOK[7]),
            ]
        ):
            p = _pet(
                db,
                owner_id=helper.id,
                name=name,
                animal_type=animal,
                breed=breed,
                gender="female" if idx % 2 else "male",
                color=color,
                status="lost",
                marks="Demo marks",
                microchip=f"TH-DEMO-EXTRA-{idx+1:03d}",
                note="Please contact owner via app.",
                weight="5.0",
            )
            _health(db, p, "None", "None", "None")
            _emergency(db, p, helper.display_name, "080-000-0005")
            _vax(
                db,
                p,
                [
                    ("Rabies", date(2026, 6, 1), date(2027, 6, 1)),
                    ("DHPP" if animal == "dog" else "FVRCP", date(2026, 5, 10), date(2027, 5, 10)),
                ],
            )
            _lost(
                db,
                pet=p,
                owner_id=helper.id,
                title=f"ตามหา {name}",
                description=f"{name} หายบริเวณ {loc[2]}",
                lat=loc[0],
                lng=loc[1],
                location=loc[2],
                hours_ago=4 + idx * 3,
            )

        # Found posts
        _found(
            db,
            reporter_id=finder.id,
            animal_type="dog",
            breed="Mixed",
            color="brown-white",
            description="พบสุนัขใส่ปลอกคอฟ้า ดูเหมือนหลงทาง ใกล้สถานีรถไฟฟ้า",
            lat=BANGKOK[1][0],
            lng=BANGKOK[1][1],
            location=BANGKOK[1][2],
            hours_ago=2,
        )
        _found(
            db,
            reporter_id=finder.id,
            animal_type="cat",
            breed="Domestic",
            color="black",
            description="แมวดำตัวเล็ก นั่งหน้าร้านกาแฟ กลัวคน",
            lat=BANGKOK[2][0],
            lng=BANGKOK[2][1],
            location=BANGKOK[2][2],
            hours_ago=5,
        )
        _found(
            db,
            reporter_id=helper.id,
            animal_type="dog",
            breed="Labrador",
            color="yellow",
            description="ลาบราดอร์สีเหลือง มีแท็กชื่อไม่ชัด เดินตามคน",
            lat=BANGKOK[4][0],
            lng=BANGKOK[4][1],
            location=BANGKOK[4][2],
            hours_ago=9,
        )
        _found(
            db,
            reporter_id=neighbor.id,
            animal_type="cat",
            breed="Siamese mix",
            color="cream-point",
            description="แมวหน้ากากสีครีม ใส่ปลอกคอระฆังเล็ก",
            lat=BANGKOK[6][0],
            lng=BANGKOK[6][1],
            location=BANGKOK[6][2],
            hours_ago=11,
        )

        # Sightings for Momo case
        sighting_specs = [
            (finder, 2, BANGKOK[0], "north", "เห็นแมวขาวส้มวิ่งเข้าซอย"),
            (neighbor, 4, BANGKOK[7], "west", "เห็นคล้ายๆ บนรั้วบ้าน"),
            (helper, 6, BANGKOK[1], "south", "ได้ยินเสียงแมวร้องใกล้ถังขยะ"),
        ]
        for reporter, hours, loc, direction, desc in sighting_specs:
            exists = db.scalar(
                select(Sighting).where(
                    Sighting.lost_post_id == momo_lost.id,
                    Sighting.description == desc,
                )
            )
            if exists is None:
                db.add(
                    Sighting(
                        lost_post_id=momo_lost.id,
                        reporter_id=reporter.id,
                        seen_at=NOW - timedelta(hours=hours),
                        latitude=loc[0] + 0.002,
                        longitude=loc[1] + 0.002,
                        location_text=loc[2],
                        direction=direction,
                        description=desc,
                    )
                )

        # Followers
        for u in (finder, neighbor, helper, guardian):
            if db.scalar(
                select(LostCaseFollower).where(
                    LostCaseFollower.lost_post_id == momo_lost.id,
                    LostCaseFollower.user_id == u.id,
                )
            ) is None:
                db.add(LostCaseFollower(lost_post_id=momo_lost.id, user_id=u.id))
        if db.scalar(
            select(LostCaseFollower).where(
                LostCaseFollower.lost_post_id == toast_lost.id,
                LostCaseFollower.user_id == owner.id,
            )
        ) is None:
            db.add(LostCaseFollower(lost_post_id=toast_lost.id, user_id=owner.id))

        # Notifications for owner
        notif_rows = [
            ("lost_alert", "Lost Pet Alert ใกล้คุณ", "มีประกาศสัตว์หายใหม่ในรัศมี 5 km", "lost_post", momo_lost.id, False),
            ("sighting", "มีเบาะแสใหม่ของ Momo", "Kind Finder แจ้งว่าเห็นใกล้ Ratchada", "lost_post", momo_lost.id, False),
            ("sighting", "อัปเดตเบาะแส Momo", "Community Helper ส่งตำแหน่งล่าสุด", "lost_post", momo_lost.id, True),
            ("guardian", "Guardian ตอบรับแล้ว", "Family Guardian สามารถช่วย mark lost ได้", "pet", momo.id, True),
            ("verification", "ยืนยันความเป็นเจ้าของ", "คำขอ microchip ของ Momo รอตรวจสอบ", "pet", momo.id, False),
            ("system", "ยินดีต้อนรับสู่ PetApp", "สำรวจ Pet ID, QR และแผนที่ใกล้ฉันได้เลย", None, None, True),
        ]
        for typ, title, body, ref_type, ref_id, is_read in notif_rows:
            exists = db.scalar(
                select(AppNotification).where(
                    AppNotification.user_id == owner.id,
                    AppNotification.title == title,
                )
            )
            if exists is None:
                db.add(
                    AppNotification(
                        user_id=owner.id,
                        type=typ,
                        title=title,
                        body=body,
                        reference_type=ref_type,
                        reference_id=ref_id,
                        is_read=is_read,
                    )
                )

        # Device tokens
        for u, platform, token in [
            (owner, "android", "demo-android-token-owner"),
            (owner, "ios", "demo-ios-token-owner"),
            (guardian, "android", "demo-android-token-guardian"),
        ]:
            if db.scalar(select(DeviceToken).where(DeviceToken.token == token)) is None:
                db.add(
                    DeviceToken(
                        user_id=u.id,
                        platform=platform,
                        token=token,
                        device_id=f"device-{platform}-{u.display_name}",
                        is_active=True,
                    )
                )

        # Ads
        ads_spec = [
            ("Happy Paws Demo", "ตรวจสุขภาพสัตว์เลี้ยง", "แพ็กเกจตรวจสุขภาพประจำปี ลด 20%", "https://example.com/pet-clinic", BANGKOK[0]),
            ("PetCafe Bangkok", "Pet-friendly Cafe", "พาสัตว์เลี้ยงมานั่งชิลได้ทุกวัน", "https://example.com/pet-cafe", BANGKOK[2]),
            ("Groomzy", "กรูมมิ่งถึงบ้าน", "ตัดขน อาบน้ำ ส่งถึงคอนโด", "https://example.com/grooming", BANGKOK[1]),
            ("PetStay Hotel", "โรงแรมสัตว์เลี้ยง", "พักสบาย มีกล้องดูออนไลน์", "https://example.com/pet-hotel", BANGKOK[5]),
        ]
        ad_objs: list[Ad] = []
        for advertiser, title, desc, url, loc in ads_spec:
            ad = db.scalar(select(Ad).where(Ad.advertiser_name == advertiser, Ad.title == title))
            if ad is None:
                ad = Ad(
                    advertiser_name=advertiser,
                    title=title,
                    description=desc,
                    image_url=None,
                    target_url=url,
                    ad_type="native",
                    status="active",
                    start_at=NOW - timedelta(days=1),
                    end_at=NOW + timedelta(days=30),
                    target_latitude=loc[0],
                    target_longitude=loc[1],
                    target_radius_km=15,
                )
                db.add(ad)
                db.flush()
            ad_objs.append(ad)

        for ad in ad_objs[:2]:
            if db.scalar(select(AdEvent).where(AdEvent.ad_id == ad.id, AdEvent.user_id == owner.id, AdEvent.event_type == "impression")) is None:
                db.add(AdEvent(ad_id=ad.id, user_id=owner.id, event_type="impression"))
            if db.scalar(select(AdEvent).where(AdEvent.ad_id == ad.id, AdEvent.user_id == owner.id, AdEvent.event_type == "click")) is None:
                db.add(AdEvent(ad_id=ad.id, user_id=owner.id, event_type="click"))

        # Chat around Momo lost case
        convo = db.scalar(
            select(Conversation).where(
                Conversation.type == "lost_found",
                Conversation.reference_id == momo_lost.id,
            )
        )
        if convo is None:
            convo = Conversation(type="lost_found", reference_id=momo_lost.id)
            db.add(convo)
            db.flush()
            for u in (owner, finder, guardian):
                db.add(ConversationMember(conversation_id=convo.id, user_id=u.id))
            messages = [
                (finder, "สวัสดีครับ ผมเห็นแมวคล้าย Momo แถว Ratchada"),
                (owner, "ขอบคุณมาก! สีและจุดส้มตรงมั้ยครับ?"),
                (finder, "ตรงครับ มีจุดส้มเหนือตาซ้าย ใส่ปลอกคอแดง"),
                (guardian, "เดี๋ยวฉันขับรถไปดูแถวนั้นให้นะ"),
                (owner, "อัปเดตตำแหน่งในแอปแล้ว ช่วยตามต่อได้เลย"),
            ]
            for i, (sender, content) in enumerate(messages):
                db.add(
                    Message(
                        conversation_id=convo.id,
                        sender_id=sender.id,
                        message_type="text",
                        content=content,
                        created_at=NOW - timedelta(minutes=40 - i * 5),
                        read_at=NOW - timedelta(minutes=10) if i < 3 else None,
                    )
                )

        db.commit()

    print("Seed complete — full mock dataset ready")
    print("Accounts (password: Demo123!):")
    print("  demo@example.com       — owner with pets + lost case")
    print("  guardian@example.com   — family guardian")
    print("  finder@example.com     — found posts + sightings")
    print("  neighbor@example.com   — nearby lost corgi")
    print("  helper@example.com     — extra lost cases for map")
    print("  admin@example.com      — admin dashboard")
    print("Tip: SEED_RESET=1 python -m app.seed  # wipe & reseed")


if __name__ == "__main__":
    run()
