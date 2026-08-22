# Keycloak OIDC for Staff Ops (WIN-4-A blocker)

> **Realm:** `ptt-staff` · **Client:** `ptt-ops-web`  
> **Plan:** [`../specs/2026-08-07-win-4-implementation-plan.md`](../specs/2026-08-07-win-4-implementation-plan.md) §5  
> **Portal reference:** [`keycloak-portal-auth.md`](./keycloak-portal-auth.md) (realm `ptt-portal` — pattern reuse)

---

## 1. IT provisioning checklist

| # | Task | Owner | Done |
|---|------|-------|------|
| IT-KC-01 | Deploy Keycloak 24+ (HA or managed IdP) with TLS | IT | ☐ |
| IT-KC-02 | Import `deploy/keycloak/realm-ptt-staff.json` | IT | ☐ |
| IT-KC-03 | Rotate **all** demo passwords (`ChangeMe-Staff-2026!`) | IT | ☐ |
| IT-KC-04 | Configure MFA OTP for groups `grp-gdkd`, `grp-super-admin` | IT | ☐ |
| IT-KC-05 | Set redirect URIs prod: `https://rs.pttads.vn/*` | IT | ☐ |
| IT-KC-06 | Publish issuer URL to Eng (`.env`) | IT | ☐ |
| IT-KC-07 | HR sheet: KC group → `position_id` mapping signed | HR + PO | ☐ |
| IT-KC-08 | Pilot 10 NV → 100 NV rollout plan | IT + PO | ☐ |

---

## 2. Local dev (Docker)

```bash
cd /path/to/rnosai
docker compose -f docker-compose.keycloak.yml up -d

# Admin console: http://127.0.0.1:8080/admin  (admin / admin)
# Realms: ptt-portal (client portal) + ptt-staff (staff ops)
```

Import / refresh staff realm:

```bash
bash scripts/keycloak_import_staff_realm.sh
```

Obtain token (dev password grant — **disable in prod**):

```bash
curl -s -X POST 'http://127.0.0.1:8080/realms/ptt-staff/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=ptt-ops-web' \
  -d 'grant_type=password' \
  -d 'username=admin@pttads.vn' \
  -d 'password=YOUR_ROTATED_PASSWORD' | jq -r .access_token
```

Verify JWKS:

```bash
curl -sf http://127.0.0.1:8080/realms/ptt-staff/protocol/openid-connect/certs | jq '.keys | length'
```

---

## 3. Nest CRM API (planned WIN-4-A)

```bash
# Phase 1 — dual auth (Nest password + Keycloak)
STAFF_AUTH_MODE=dual
PTT_STAFF_KEYCLOAK_ISSUER=http://127.0.0.1:8080/realms/ptt-staff
PTT_STAFF_KEYCLOAK_AUDIENCE=ptt-ops-web

# Phase 2 — cutover (after EC-W4-01)
STAFF_AUTH_MODE=keycloak
```

Staff routes will validate Bearer via JWKS (`/protocol/openid-connect/certs`).

**Group → position map** (DB table `staff_keycloak_group_map`, seed after HR sign):

| Keycloak group | `position_id` | Notes |
|----------------|---------------|-------|
| `grp-super-admin` | 1 | Bypass scope |
| `grp-gdkd` | (GDKD code) | MFA required |
| `grp-am` | AM-01 | Client scope pilot |
| `grp-mkt` | MKT-01 | Solution queue |
| `grp-cskh` | CSKH-01 | SLA board |
| `grp-it-admin` | IT configure | |
| `grp-hr-ops` | HR roster edit | |

---

## 4. ops-web (planned WIN-4-A)

```bash
NEXT_PUBLIC_WIN_SSO=1
NEXT_PUBLIC_PTT_KEYCLOAK_ISSUER=https://auth.example/realms/ptt-staff
NEXT_PUBLIC_PTT_KEYCLOAK_CLIENT_ID=ptt-ops-web
```

`/login` → redirect Keycloak authorization code + PKCE; local dev fallback when `NEXT_PUBLIC_WIN_SSO=0`.

---

## 5. Staging / prod rollout

1. IT imports realm on staging IdP · Eng sets `STAFF_AUTH_MODE=dual` on `rs.pttads.vn`
2. Pilot 10 NV login Keycloak · shadow compare caps vs Nest password
3. Comms email all staff (Master §12.3 WIN-4)
4. Cutover: `STAFF_AUTH_MODE=keycloak` · disable Nest password (`staff_auth_cutover_keycloak.sh`)
5. EC-W4-01 sign-off

---

## 6. Rollback

```bash
STAFF_AUTH_MODE=nest
# Remove PTT_STAFF_KEYCLOAK_* from .env
sudo systemctl restart ptt-crm-api ptt-ops-web
```

Break-glass: retain one Nest super-admin password 72h post-cutover (document in IT vault).

---

## 7. Security notes

- **Never** commit prod client secrets to git
- Rotate demo users in `realm-ptt-staff.json` before any shared staging
- MFA enforced via Keycloak **Conditional OTP** flow on `grp-gdkd` + `grp-super-admin`
- Session idle timeout ≤ 8h · refresh token rotation enabled

---

*Blocker WIN-4-A kickoff:* IT-KC-01…06 complete + issuer URL in staging `.env`.
