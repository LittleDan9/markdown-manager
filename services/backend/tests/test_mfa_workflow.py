"""
Test the complete MFA TOTP API workflow using a simulated TOTP generator (pyotp).
"""
import uuid

import pyotp
import pytest


# Remove test_app and client fixtures - use the ones from conftest.py


class TOTPSimulator:
    def __init__(self, secret: str):
        self.secret = secret
        self.totp = pyotp.TOTP(secret)

    def get_current_code(self) -> str:
        return self.totp.now()

    def get_code_at_time(self, timestamp: int) -> str:
        return self.totp.at(timestamp)


async def register_and_login(client, email, password, **extra):
    # Register
    reg_data = {"email": email, "password": password}
    reg_data.update(extra)
    reg_resp = await client.post("/auth/register", json=reg_data)
    # Accept either success or "already exists" error
    assert reg_resp.status_code in [200, 400]
    if reg_resp.status_code == 400:
        assert "already" in reg_resp.text.lower()

    # Login
    login_resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return token


@pytest.mark.asyncio
async def test_mfa_totp_workflow(client):
    email = f"mfauser-{uuid.uuid4()}@example.com"
    password = "MfaTestPassword123!"
    token = await register_and_login(
        client, email, password, first_name="MFA", last_name="User"
    )
    headers = {"Authorization": f"Bearer {token}"}

    async def setup_mfa():
        setup_resp = await client.post("/auth/mfa/setup", headers=headers)
        assert setup_resp.status_code == 200
        setup_data = setup_resp.json()
        assert "secret" in setup_data
        return TOTPSimulator(setup_data["secret"])

    async def verify_totp(totp):
        code = totp.get_current_code()
        verify_resp = await client.post(
            "/auth/mfa/verify", json={"totp_code": code}, headers=headers
        )
        assert verify_resp.status_code == 200

    async def enable_mfa(totp):
        enable_resp = await client.post(
            "/auth/mfa/enable",
            json={"totp_code": totp.get_current_code(), "current_password": password},
            headers=headers,
        )
        assert enable_resp.status_code == 200

    async def get_backup_codes():
        backup_resp = await client.get("/auth/mfa/backup-codes", headers=headers)
        assert backup_resp.status_code == 200
        backup_data = backup_resp.json()
        assert "backup_codes" in backup_data
        assert len(backup_data["backup_codes"]) > 0
        return backup_data["backup_codes"]

    async def regenerate_backup_codes(totp):
        regen_resp = await client.post(
            "/auth/mfa/regenerate-backup-codes",
            json={"totp_code": totp.get_current_code()},
            headers=headers,
        )
        assert regen_resp.status_code == 200
        return regen_resp.json()["backup_codes"]

    async def disable_mfa(totp):
        disable_resp = await client.post(
            "/auth/mfa/disable",
            json={"totp_code": totp.get_current_code(), "current_password": password},
            headers=headers,
        )
        assert disable_resp.status_code == 200

    totp = await setup_mfa()
    await verify_totp(totp)
    await enable_mfa(totp)
    backup_codes = await get_backup_codes()
    new_codes = await regenerate_backup_codes(totp)
    assert new_codes != backup_codes
    await disable_mfa(totp)
