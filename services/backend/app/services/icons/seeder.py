"""Auto-seed icon packs from bundled seed JSON files on startup."""
import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.icon_models import IconPack
from app.schemas.icon_schemas import IconifyIconData, StandardizedIconPackRequest
from app.services.icons.installer import StandardizedIconPackInstaller

logger = logging.getLogger(__name__)

# Where the Dockerfile copies the extracted seed files
SEED_DIR = Path("/app/seed-icons")
# Dev fallback: when running outside Docker (local dev)
SEED_DIR_DEV = Path(__file__).resolve().parents[3] / "seed-icons" / "data"


def _find_seed_dir() -> Optional[Path]:
    """Return the first existing seed directory, or None."""
    for candidate in (SEED_DIR, SEED_DIR_DEV):
        if candidate.is_dir() and any(candidate.glob("*.seed.json")):
            return candidate
    return None


class IconSeeder:
    """Loads .seed.json files and installs/updates packs that are missing or outdated."""

    async def seed_if_needed(self) -> None:
        seed_dir = _find_seed_dir()
        if seed_dir is None:
            logger.info("No seed-icons directory found — skipping icon seeding")
            return

        seed_files = sorted(seed_dir.glob("*.seed.json"))
        if not seed_files:
            return

        logger.info("Found %d seed file(s) in %s", len(seed_files), seed_dir)

        async with AsyncSessionLocal() as db:
            for sf in seed_files:
                try:
                    await self._process_seed_file(db, sf)
                except Exception:
                    logger.exception("Failed to process seed file %s", sf.name)

    async def _process_seed_file(self, db: AsyncSession, seed_path: Path) -> None:
        raw = json.loads(seed_path.read_text())
        pack_name: str = raw["info"]["name"]
        seed_version: str = raw.get("_seed", {}).get("version", "unknown")

        existing = await self._get_pack(db, pack_name)

        if existing is not None:
            stored_version = existing.description_meta_seed_version if hasattr(existing, 'description_meta_seed_version') else None
            # Check if pack was seeded and version matches by checking description
            if existing.description and f"[seed:{seed_version}]" in existing.description:
                logger.debug("Pack '%s' already at seed version %s — skipping", pack_name, seed_version)
                return

            # Pack exists but is outdated or was manually created — only update seeded packs
            if existing.description and "[seed:" in existing.description:
                logger.info("Updating seeded pack '%s' to version %s", pack_name, seed_version)
                # Delete existing pack so we can reinstall
                await db.delete(existing)
                await db.flush()
            else:
                # Pack exists but was NOT seeded (admin-added) — leave it alone
                logger.debug("Pack '%s' exists (admin-added) — skipping seed", pack_name)
                return

        # Build a StandardizedIconPackRequest from the seed data
        icons_dict = {}
        for icon_key, icon_data in raw.get("icons", {}).items():
            icons_dict[icon_key] = IconifyIconData(
                body=icon_data["body"],
                width=icon_data.get("width", raw.get("width", 24)),
                height=icon_data.get("height", raw.get("height", 24)),
                viewBox=icon_data.get("viewBox"),
            )

        if not icons_dict:
            logger.warning("Seed file %s has no icons — skipping", seed_path.name)
            return

        # Tag the description with seed version so we can detect updates
        description = raw["info"].get("description", "")
        description = f"{description} [seed:{seed_version}]"
        raw["info"]["description"] = description

        pack_request = StandardizedIconPackRequest(
            info=raw["info"],
            icons=icons_dict,
            width=raw.get("width", 24),
            height=raw.get("height", 24),
        )

        installer = StandardizedIconPackInstaller(db)
        result = await installer.install_pack(pack_request)
        logger.info(
            "Seeded pack '%s' v%s — %d icons installed",
            pack_name, seed_version, result.icon_count,
        )

    @staticmethod
    async def _get_pack(db: AsyncSession, name: str) -> Optional[IconPack]:
        result = await db.execute(select(IconPack).where(IconPack.name == name))
        return result.scalar_one_or_none()
