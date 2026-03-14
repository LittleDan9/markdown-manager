"""
Git repository maintenance service.

Runs periodic git gc across all user repositories to pack loose objects
and reduce disk usage from accumulated auto-save commits.
"""
import asyncio
import logging
from pathlib import Path

from app.configs.settings import get_settings
from .operations import run_gc

logger = logging.getLogger(__name__)
settings = get_settings()


class GitMaintenanceService:
    """
    Background service that runs git gc on all user repositories daily.

    Each user's local categories are separate git repos under:
        /storage/{user_id}/local/{category_name}/.git

    Session-based auto-save creates roughly one commit per 30-second idle
    period. Over time this produces many loose objects; gc packs them into
    efficient pack files and prunes unreachable objects.
    """

    # Run once per day by default
    GC_INTERVAL_SECONDS = 86_400

    def __init__(self):
        self.storage_root = Path(settings.markdown_storage_root)
        self.running = False
        self._task = None

    async def start(self) -> None:
        """Start the background gc loop."""
        if self.running:
            return
        self.running = True
        logger.info("Starting git maintenance (gc) background service")
        self._task = asyncio.create_task(self._gc_loop())

    def stop(self) -> None:
        """Stop the background gc loop."""
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Stopping git maintenance background service")

    async def _gc_loop(self) -> None:
        """Main loop: run gc then sleep for GC_INTERVAL_SECONDS."""
        while self.running:
            try:
                await self.run_gc_all_repos()
            except Exception as e:
                logger.error(f"Git maintenance loop error: {e}")
            await asyncio.sleep(self.GC_INTERVAL_SECONDS)

    async def run_gc_all_repos(self) -> dict:
        """
        Walk all user storage directories and run git gc on every local repo.

        Returns a summary dict with counts of successes and failures.
        """
        if not self.storage_root.exists():
            logger.warning(f"Storage root does not exist: {self.storage_root}")
            return {"processed": 0, "success": 0, "failed": 0}

        processed = 0
        success = 0
        failed = 0

        # Pattern: /storage/{user_id}/local/{category_name}/.git
        for user_dir in self.storage_root.iterdir():
            if not user_dir.is_dir():
                continue
            local_dir = user_dir / "local"
            if not local_dir.exists():
                continue
            for category_dir in local_dir.iterdir():
                if not category_dir.is_dir():
                    continue
                if not (category_dir / ".git").exists():
                    continue
                processed += 1
                ok = await run_gc(category_dir)
                if ok:
                    success += 1
                else:
                    failed += 1

        logger.info(
            f"Git gc completed: {processed} repos processed, "
            f"{success} succeeded, {failed} failed"
        )
        return {"processed": processed, "success": success, "failed": failed}


# Singleton instance used by app_factory lifespan
git_maintenance_service = GitMaintenanceService()
