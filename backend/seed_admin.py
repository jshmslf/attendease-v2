import asyncio
import uuid
from app.db.session import AsyncSessionLocal
from app.models.models import AdminAccount, Student, PortalAccount
from app.core.security import hash_password


async def main():
    async with AsyncSessionLocal() as db:
        # Create default admin account
        admin = AdminAccount(
            id=str(uuid.uuid4()),
            username="admin",
            email="admin@attendease.edu",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role="superadmin",
        )
        db.add(admin)

        # Create a demo student for testing
        demo_student = Student(
            id=str(uuid.uuid4()),
            student_id="2024-00001",
            first_name="Demo",
            last_name="Student",
            email="demo@university.edu",
            course="BS Computer Science",
            year_level=3,
        )
        db.add(demo_student)
        await db.flush()  # get demo_student.id before commit

        # Create portal account for demo student
        portal = PortalAccount(
            id=str(uuid.uuid4()),
            student_id=demo_student.id,
            username="student",
            hashed_password=hash_password("student123"),
        )
        db.add(portal)

        await db.commit()

        print("Seeding complete!")
        print("-" * 30)
        print("Admin login:  admin / admin123")
        print("Student portal login:  student / student123")
        print("-" * 30)


asyncio.run(main())
