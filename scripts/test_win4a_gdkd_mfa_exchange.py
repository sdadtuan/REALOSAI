#!/usr/bin/env python3
"""WIN-4-A staging: PKCE login + OIDC exchange MFA gate test for gdkd-demo."""
from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import ssl
import urllib.error
import urllib.parse
import urllib.request

REDIRECT = "https://rs.pttads.vn/login/callback"
API = "http://127.0.0.1:3000/api/v1/staff/auth/oidc/exchange"
USER = "gdkd-demo@pttads.vn"
PASSWORD = "ChangeMe-Staff-2026!"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def main() -> int:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    state = b64url(secrets.token_bytes(16))
    params = urllib.parse.urlencode(
        {
            "client_id": "ptt-ops-web",
            "redirect_uri": REDIRECT,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    auth_url = f"https://rs.pttads.vn/auth/realms/ptt-staff/protocol/openid-connect/auth?{params}"

    cookie = ""
    req = urllib.request.Request(auth_url, headers={"Cookie": cookie})
    with urllib.request.urlopen(req, context=ctx) as resp:
        html = resp.read().decode()
        if resp.headers.get("Set-Cookie"):
            cookie = resp.headers.get("Set-Cookie", "").split(";")[0]

    match = re.search(r'"loginAction"\s*:\s*"([^"]+)"', html) or re.search(
        r'action="([^"]+)"', html
    )
    if not match:
        print("FAIL: Keycloak login form not found")
        return 1
    login_url = match.group(1).replace("\\/", "/")
    form = urllib.parse.urlencode({"username": USER, "password": PASSWORD}).encode()
    req2 = urllib.request.Request(
        login_url,
        data=form,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie},
    )
    with urllib.request.urlopen(req2, context=ctx) as resp2:
        final = resp2.geturl()
    code = urllib.parse.parse_qs(urllib.parse.urlparse(final).query).get("code", [""])[0]
    if not code:
        print("FAIL: no authorization code", final)
        return 1

    payload = json.dumps(
        {"code": code, "redirect_uri": REDIRECT, "code_verifier": verifier}
    ).encode()
    req3 = urllib.request.Request(
        API,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req3) as resp3:
            print("FAIL: exchange succeeded unexpectedly:", resp3.read().decode()[:200])
            return 1
    except urllib.error.HTTPError as err:
        body = err.read().decode()
        print("HTTP", err.code, body)
        if err.code == 403 and "mfa_required" in body:
            print("PASS: GDKD MFA gate blocks OIDC exchange")
            return 0
        print("FAIL: unexpected exchange error")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
