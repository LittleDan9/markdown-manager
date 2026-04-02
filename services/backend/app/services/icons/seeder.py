"""Auto-seed icon packs from bundled seed JSON files on startup."""
import json
import logging
import os
from pathlib import Path
from typing import Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconifyIconData, StandardizedIconPackRequest
from app.services.icons.installer import StandardizedIconPackInstaller

logger = logging.getLogger(__name__)

# Where the Dockerfile copies the extracted seed files
SEED_DIR = Path("/markdown-manager/seed-icons")
# Dev compose uses working_dir /markdown_manager (underscore)
SEED_DIR_ALT = Path("/markdown_manager/seed-icons")
# Dev fallback: when running outside Docker (local dev)
SEED_DIR_DEV = Path(__file__).resolve().parents[3] / "seed-icons" / "data"


def _find_seed_dir() -> Optional[Path]:
    """Return the first existing seed directory, or None."""
    for candidate in (SEED_DIR, SEED_DIR_ALT, SEED_DIR_DEV):
        if candidate.is_dir() and any(candidate.glob("*.seed.json")):
            return candidate
    return None


class IconSeeder:
    """Loads .seed.json files and installs/updates packs that are missing or outdated."""

    async def seed_if_needed(self) -> None:
        """Startup hook — uses env var for legacy adoption."""
        force = os.environ.get("ICON_SEED_ADOPT_LEGACY", "").lower() in ("1", "true", "yes")
        await self.run_seeding(force_all=force)

    async def run_seeding(self, force_all: bool = False) -> dict:
        """Run the seeding pipeline.

        Args:
            force_all: When True, adopt legacy (admin-added) packs so they
                       are re-installed from the bundled seed files.

        Returns:
            Summary dict with results per pack.
        """
        seed_dir = _find_seed_dir()
        if seed_dir is None:
            logger.info("No seed-icons directory found — skipping icon seeding")
            return {"status": "skipped", "reason": "no_seed_dir", "packs": []}

        seed_files = sorted(seed_dir.glob("*.seed.json"))
        if not seed_files:
            return {"status": "skipped", "reason": "no_seed_files", "packs": []}

        logger.info("Found %d seed file(s) in %s", len(seed_files), seed_dir)

        results: list[dict] = []

        async with AsyncSessionLocal() as db:
            if force_all:
                await self._adopt_legacy_packs(db, seed_files)

            for sf in seed_files:
                try:
                    result = await self._process_seed_file(db, sf)
                    results.append(result)
                except Exception as exc:
                    logger.exception("Failed to process seed file %s", sf.name)
                    results.append({"pack": sf.stem, "action": "error", "error": str(exc)})

        return {"status": "completed", "packs": results}

    async def _process_seed_file(self, db: AsyncSession, seed_path: Path) -> dict:
        raw = json.loads(seed_path.read_text())
        pack_name: str = raw["info"]["name"]
        seed_version: str = raw.get("_seed", {}).get("version", "unknown")

        existing = await self._get_pack(db, pack_name)

        if existing is not None:
            # Check if pack was seeded and version matches by checking description
            if existing.description and f"[seed:{seed_version}]" in existing.description:
                logger.debug("Pack '%s' already at seed version %s — skipping", pack_name, seed_version)
                return {"pack": pack_name, "version": seed_version, "action": "skipped", "reason": "up_to_date"}

            # Pack exists but is outdated or was manually created — only update seeded packs
            if existing.description and "[seed:" in existing.description:
                new_keys = set(raw.get("icons", {}).keys())
                await self._check_icon_compatibility(db, existing, new_keys, seed_version)
                await db.delete(existing)
                await db.flush()
            else:
                # Pack exists but was NOT seeded (admin-added) — leave it alone
                logger.debug(
                    "Pack '%s' exists (admin-added) — skipping seed. "
                    "Use force_all to adopt legacy packs.",
                    pack_name,
                )
                return {"pack": pack_name, "action": "skipped", "reason": "admin_added"}

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
            return {"pack": pack_name, "action": "skipped", "reason": "no_icons"}

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
        return {
            "pack": pack_name,
            "version": seed_version,
            "action": "installed",
            "icon_count": result.icon_count,
        }

    async def _check_icon_compatibility(
        self, db: AsyncSession, pack: IconPack, new_keys: Set[str], new_version: str
    ) -> None:
        """Compare old and new icon keys before an upgrade.

        When icons are removed, scans documents for broken references and
        sends per-user notifications identifying affected documents.
        """
        result = await db.execute(
            select(IconMetadata.key).where(IconMetadata.pack_id == pack.id)
        )
        old_keys: Set[str] = {row[0] for row in result.all()}

        removed = old_keys - new_keys
        added = new_keys - old_keys

        if removed:
            logger.warning(
                "Upgrading pack '%s' to v%s — %d icon(s) REMOVED: %s",
                pack.name, new_version, len(removed),
                ", ".join(sorted(removed)[:20]) + ("..." if len(removed) > 20 else ""),
            )
            try:
                await self._notify_impacted_documents(db, pack.name, removed, new_version)
            except Exception:
                logger.exception("Failed to scan/notify for removed icons in pack '%s'", pack.name)

        if added:
            logger.info(
                "Upgrading pack '%s' to v%s — %d new icon(s) added",
                pack.name, new_version, len(added),
            )

        # Broadcast a general update notification to all users
        try:
            await self._broadcast_pack_updated(db, pack.name, new_version, len(added), len(removed))
        except Exception:
            logger.exception("Failed to broadcast pack update notification for '%s'", pack.name)

        if not removed and not added:
            logger.info(
                "Upgrading pack '%s' to v%s — icon keys unchanged (content-only update)",
                pack.name, new_version,
            )

    async def _notify_impacted_documents(
        self, db: AsyncSession, pack_name: str, removed_keys: Set[str], new_version: str
    ) -> None:
        """Scan documents for references to removed icons using grep + targeted reads.

        Uses kernel-level ``grep -rl`` to find only files containing the pack
        prefix, then reads only those files with Python to identify specific
        removed-key matches.  This avoids reading every document on disk.
        """
        import asyncio
        import re
        from app.routers.notifications import create_notification

        DOCUMENT_ROOT = Path("/documents")
        if not DOCUMENT_ROOT.is_dir():
            logger.debug("Document root %s not found — skipping impact scan", DOCUMENT_ROOT)
            return

        # Step 1: grep for files that reference this pack at all
        pack_prefix = f"{pack_name}:"
        try:
            proc = await asyncio.subprocess.create_subprocess_exec(
                "grep", "-rl", "--include=*.md", pack_prefix, str(DOCUMENT_ROOT),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
        except FileNotFoundError:
            logger.warning("grep not available — falling back to full scan")
            await self._notify_impacted_documents_fallback(db, pack_name, removed_keys, new_version)
            return

        matching_paths = [p for p in stdout.decode().strip().splitlines() if p]
        if not matching_paths:
            logger.debug("No documents reference pack '%s' — nothing to notify", pack_name)
            return

        logger.info(
            "grep found %d file(s) referencing '%s' — checking for removed keys",
            len(matching_paths), pack_name,
        )

        # Step 2: build regex for removed keys only
        escaped_keys = [re.escape(k) for k in removed_keys]
        pattern = re.compile(
            rf'{re.escape(pack_name)}:({"|".join(escaped_keys)})'
        )

        # Step 3: read only matching files, extract user_id from path
        # Path pattern: /documents/{user_id}/local/{category}/{name}.md
        user_impact: dict[int, dict] = {}

        for fpath in matching_paths:
            try:
                parts = Path(fpath).relative_to(DOCUMENT_ROOT).parts
                user_id = int(parts[0])
            except (ValueError, IndexError):
                continue

            try:
                content = Path(fpath).read_text(errors="replace")
            except OSError:
                continue

            matches = set(pattern.findall(content))
            if not matches:
                continue

            entry = user_impact.setdefault(user_id, {"broken_icons": set(), "doc_count": 0})
            entry["broken_icons"].update(matches)
            entry["doc_count"] += 1

        # Step 4: batch-create notifications for impacted users
        notified_count = 0
        for user_id, impact in user_impact.items():
            broken = impact["broken_icons"]
            broken_list = ", ".join(sorted(broken)[:10])
            if len(broken) > 10:
                broken_list += f" (+{len(broken) - 10} more)"

            await create_notification(
                db=db,
                user_id=user_id,
                title=f"Icon pack '{pack_name}' updated — {len(broken)} icon(s) removed",
                message=(
                    f"The '{pack_name}' icon pack was updated to v{new_version}. "
                    f"{len(broken)} icon(s) used in your documents were removed: {broken_list}. "
                    f"Affected documents ({impact['doc_count']}) may show broken icon references."
                ),
                category="warning",
            )
            notified_count += 1

        if notified_count:
            await db.commit()
            logger.info(
                "Notified %d user(s) about broken icon references from pack '%s' upgrade",
                notified_count, pack_name,
            )

    async def _notify_impacted_documents_fallback(
        self, db: AsyncSession, pack_name: str, removed_keys: Set[str], new_version: str
    ) -> None:
        """Fallback scan when grep is unavailable — walks filesystem with Python."""
        import re
        from app.routers.notifications import create_notification

        DOCUMENT_ROOT = Path("/documents")
        escaped_keys = [re.escape(k) for k in removed_keys]
        pattern = re.compile(
            rf'{re.escape(pack_name)}:({"|".join(escaped_keys)})'
        )
        fast_check = f"{pack_name}:"

        user_impact: dict[int, dict] = {}

        for md_file in DOCUMENT_ROOT.rglob("*.md"):
            try:
                parts = md_file.relative_to(DOCUMENT_ROOT).parts
                user_id = int(parts[0])
            except (ValueError, IndexError):
                continue
            try:
                content = md_file.read_text(errors="replace")
            except OSError:
                continue
            if fast_check not in content:
                continue
            matches = set(pattern.findall(content))
            if not matches:
                continue
            entry = user_impact.setdefault(user_id, {"broken_icons": set(), "doc_count": 0})
            entry["broken_icons"].update(matches)
            entry["doc_count"] += 1

        notified_count = 0
        for user_id, impact in user_impact.items():
            broken = impact["broken_icons"]
            broken_list = ", ".join(sorted(broken)[:10])
            if len(broken) > 10:
                broken_list += f" (+{len(broken) - 10} more)"
            await create_notification(
                db=db,
                user_id=user_id,
                title=f"Icon pack '{pack_name}' updated — {len(broken)} icon(s) removed",
                message=(
                    f"The '{pack_name}' icon pack was updated to v{new_version}. "
                    f"{len(broken)} icon(s) used in your documents were removed: {broken_list}. "
                    f"Affected documents ({impact['doc_count']}) may show broken icon references."
                ),
                category="warning",
            )
            notified_count += 1

        if notified_count:
            await db.commit()
            logger.info(
                "Notified %d user(s) about broken icon references from pack '%s' upgrade (fallback)",
                notified_count, pack_name,
            )

    async def _broadcast_pack_updated(
        self, db: AsyncSession, pack_name: str, new_version: str, added: int, removed: int
    ) -> None:
        """Send a general notification to all users that a pack was updated."""
        from app.routers.notifications import broadcast_notification

        parts = [f"The '{pack_name}' icon pack has been updated to v{new_version}."]
        if added:
            parts.append(f"{added} new icon(s) added.")
        if removed:
            parts.append(f"{removed} icon(s) removed.")

        count = await broadcast_notification(
            db=db,
            title=f"Icon pack updated: {pack_name} v{new_version}",
            message=" ".join(parts),
            category="info" if not removed else "warning",
        )
        await db.commit()
        logger.info("Broadcast pack update notification to %d user(s)", count)

    async def _adopt_legacy_packs(
        self, db: AsyncSession, seed_files: list[Path]
    ) -> None:
        """Tag admin-added packs that match seed files with ``[seed:0.0.0]``.

        This lets the normal upgrade path pick them up on the same startup.
        Intended as a one-time migration — remove the env var after running.
        """
        seed_names: set[str] = set()
        for sf in seed_files:
            try:
                raw = json.loads(sf.read_text())
                seed_names.add(raw["info"]["name"])
            except Exception:
                continue

        adopted = 0
        for name in sorted(seed_names):
            pack = await self._get_pack(db, name)
            if pack is None:
                continue
            # Already managed by the seeder — nothing to do
            if pack.description and "[seed:" in pack.description:
                continue
            old_desc = pack.description or ""
            pack.description = f"{old_desc} [seed:0.0.0]".strip()
            adopted += 1
            logger.info("Adopted legacy pack '%s' for seeder management", name)

        if adopted:
            await db.commit()
            logger.info(
                "Adopted %d legacy pack(s) — they will be upgraded on this startup. "
                "Remove ICON_SEED_ADOPT_LEGACY after this run.",
                adopted,
            )

    @staticmethod
    async def _get_pack(db: AsyncSession, name: str) -> Optional[IconPack]:
        result = await db.execute(select(IconPack).where(IconPack.name == name))
        return result.scalar_one_or_none()
