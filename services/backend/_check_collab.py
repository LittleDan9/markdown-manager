import asyncio
from app.database import async_session
from sqlalchemy import select
from app.models.document import Document
from app.models.document_collaborator import DocumentCollaborator
from app.models.user import User

async def check():
    async with async_session() as db:
        r = await db.execute(select(Document).where(Document.name == "Tab Doc 3"))
        d = r.scalar_one_or_none()
        if d:
            print(f"Doc id={d.id} owner={d.user_id}")
            cr = await db.execute(select(DocumentCollaborator).where(DocumentCollaborator.document_id == d.id))
            for c in cr.scalars():
                print(f"  collab uid={c.user_id} role={c.role}")
        else:
            print("NOT FOUND")
        ur = await db.execute(select(User.id, User.email))
        for u in ur:
            print(f"  user id={u[0]} email={u[1]}")

asyncio.run(check())
