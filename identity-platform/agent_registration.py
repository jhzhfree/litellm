"""Identity-platform control API for autonomous gateway workloads."""

import os
import sqlite3
from contextlib import contextmanager
from functools import cached_property
from uuid import UUID

import httpx
import jwt
from agentctl import trusted_url
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_SCOPE = "gateway.invoke"


class Registration(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    operation_id: UUID
    name: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def operator(authorization: str = Header(default="")) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "An operator access token is required")
    try:
        issuer = trusted_url(os.environ["AGENT_ADMIN_ISSUER"])
        jwks = jwt.PyJWKClient(trusted_url(os.environ["AGENT_ADMIN_JWKS_URL"]), timeout=5)
        claims = jwt.decode(
            token,
            jwks.get_signing_key_from_jwt(token).key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=os.environ["AGENT_ADMIN_AUDIENCE"],
            options={"require": ["exp", "iat", "iss", "sub", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid operator access token") from exc
    scope = claims.get("scope")
    if (
        not isinstance(scope, str)
        or "agent.register" not in scope.split()
        or claims.get("azp") != os.environ["AGENT_ADMIN_OPERATOR_CLIENT_ID"]
        or claims.get("identity_kind") == "workload"
        or not claims["sub"]
    ):
        raise HTTPException(403, "Agent registration is not authorized")
    return claims["sub"]


@contextmanager
def operation_store():
    connection = sqlite3.connect(os.environ["AGENT_ADMIN_DB"], timeout=5)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS registrations (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL,
                subject TEXT, gateway_agent_id TEXT, credential_claimed INTEGER NOT NULL DEFAULT 0,
                UNIQUE(owner, name)
            )""")
            try:
                connection.execute("BEGIN IMMEDIATE")
            except sqlite3.OperationalError as exc:
                if exc.sqlite_errorcode != sqlite3.SQLITE_BUSY:
                    raise
                raise HTTPException(503, "Registration service is busy; retry the same operation") from None
            yield connection
    finally:
        connection.close()


def load_operation(db: sqlite3.Connection, operation_id: str, owner: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM registrations WHERE id = ? AND owner = ?", (operation_id, owner)).fetchone()
    if row is None:
        raise HTTPException(404, "Agent registration was not found")
    return row


def operation_status(row: sqlite3.Row) -> dict:
    return {
        "operation_id": row["id"],
        "name": row["name"],
        "state": row["state"],
        "issuer": os.environ["AGENT_ADMIN_ISSUER"],
        "client_id": f"managed-agent-{row['id']}",
        "subject": row["subject"],
        "gateway_agent_id": row["gateway_agent_id"],
        "credential_claimed": bool(row["credential_claimed"]),
    }


class Provisioner:
    def __init__(self, client: httpx.Client):
        self.client = client
        self.issuer = trusted_url(os.environ["AGENT_ADMIN_ISSUER"])
        base, delimiter, realm = self.issuer.rpartition("/realms/")
        if not delimiter or not base or not realm or "/" in realm:
            raise ValueError("Expected a Keycloak realm issuer")
        self.admin = f"{base}/admin/realms/{realm}"
        self.gateway = trusted_url(os.environ["AGENT_ADMIN_GATEWAY_URL"]).rstrip("/")
        self.gateway_auth = {"Authorization": "Bearer " + os.environ["AGENT_ADMIN_GATEWAY_TOKEN"]}

    @cached_property
    def keycloak_auth(self) -> dict[str, str]:
        token = self.client.post(
            self.issuer + "/protocol/openid-connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": os.environ["AGENT_ADMIN_KEYCLOAK_CLIENT_ID"],
                "client_secret": os.environ["AGENT_ADMIN_KEYCLOAK_CLIENT_SECRET"],
            },
        )
        token.raise_for_status()
        return {"Authorization": "Bearer " + token.json()["access_token"]}

    def keycloak(self, method: str, path: str, **kwargs) -> httpx.Response:
        return self.client.request(method, self.admin + path, headers=self.keycloak_auth, **kwargs)

    def gateway_request(self, method: str, path: str, **kwargs) -> httpx.Response:
        return self.client.request(method, self.gateway + path, headers=self.gateway_auth, **kwargs)

    def find_identity(self, client_id: str) -> dict | None:
        reply = self.keycloak("GET", "/clients", params={"clientId": client_id})
        reply.raise_for_status()
        matches = [client for client in reply.json() if client.get("clientId") == client_id]
        if len(matches) > 1 or (matches and matches[0].get("description") != "LiteLLM operation " + client_id):
            raise HTTPException(409, "Identity client conflicts with an existing account")
        return matches[0] if matches else None

    def ensure_identity(self, client_id: str) -> tuple[str, str]:
        identity = self.find_identity(client_id)
        if identity is None:
            created = self.keycloak(
                "POST",
                "/clients",
                json={
                    "clientId": client_id,
                    "description": "LiteLLM operation " + client_id,
                    "enabled": False,
                    "protocol": "openid-connect",
                    "serviceAccountsEnabled": True,
                    "standardFlowEnabled": False,
                    "directAccessGrantsEnabled": False,
                    "publicClient": False,
                    "protocolMappers": [
                        {
                            "name": "workload-kind",
                            "protocol": "openid-connect",
                            "protocolMapper": "oidc-hardcoded-claim-mapper",
                            "config": {
                                "claim.name": "identity_kind",
                                "claim.value": "workload",
                                "jsonType.label": "String",
                                "access.token.claim": "true",
                            },
                        },
                        {
                            "name": "gateway-audience",
                            "protocol": "openid-connect",
                            "protocolMapper": "oidc-audience-mapper",
                            "config": {
                                "included.custom.audience": os.environ["AGENT_ADMIN_GATEWAY_AUDIENCE"],
                                "access.token.claim": "true",
                                "id.token.claim": "false",
                            },
                        },
                    ],
                },
            )
            if created.status_code != 409:
                created.raise_for_status()
            identity = self.find_identity(client_id)
        if identity is None:
            raise HTTPException(502, "Identity creation was not confirmed")
        internal = str(UUID(identity["id"]))
        scopes = self.keycloak("GET", "/client-scopes")
        scopes.raise_for_status()
        eligible = [
            scope
            for scope in scopes.json()
            if scope.get("name") == _SCOPE and scope.get("attributes", {}).get("include.in.token.scope") == "true"
        ]
        if len(eligible) != 1:
            raise HTTPException(503, "Keycloak requires a gateway.invoke client scope included in tokens")
        scope_id = str(UUID(eligible[0]["id"]))
        self.keycloak("PUT", f"/clients/{internal}/default-client-scopes/{scope_id}").raise_for_status()
        subject = self.keycloak("GET", f"/clients/{internal}/service-account-user")
        subject.raise_for_status()
        return internal, str(UUID(subject.json()["id"]))

    def gateway_identity(self, client_id: str, subject: str) -> dict:
        return {
            "provider": "external_oidc",
            "tenant_id": self.issuer,
            "client_id": client_id,
            "service_principal_id": subject,
            "required_scopes": [_SCOPE],
        }

    def matches_gateway_binding(self, agent: dict, client_id: str, subject: str) -> bool:
        identity = agent.get("identity")
        expected = {**self.gateway_identity(client_id, subject), "issuer": self.issuer}
        return (
            agent.get("agent_name") == client_id
            and agent.get("enabled") is True
            and agent.get("identity_managed") is True
            and agent.get("execution_mode") == "autonomous"
            and isinstance(identity, dict)
            and identity.get("agent_id") == agent.get("agent_id")
            and identity.get("active") is True
            and all(identity.get(field) == value for field, value in expected.items())
        )

    def find_gateway_binding(self, client_id: str, subject: str) -> str | None:
        agents = self.gateway_request("GET", "/v1/agents")
        agents.raise_for_status()
        matching = [agent for agent in agents.json() if agent.get("agent_name") == client_id]
        if not matching:
            return None
        if len(matching) != 1 or not self.matches_gateway_binding(matching[0], client_id, subject):
            raise HTTPException(409, "Gateway Agent conflicts with the requested identity")
        return str(UUID(matching[0]["agent_id"]))

    def ensure_gateway_binding(self, client_id: str, subject: str, previous_agent_id: str | None) -> str:
        existing = self.find_gateway_binding(client_id, subject)
        if previous_agent_id is not None and existing != previous_agent_id:
            raise HTTPException(409, "The original gateway binding was replaced")
        if existing is not None:
            return existing
        created = self.gateway_request(
            "POST",
            "/v1/agents",
            json={
                "agent_name": client_id,
                "execution_mode": "autonomous",
                "identity": self.gateway_identity(client_id, subject),
            },
        )
        created.raise_for_status()
        agent = created.json()
        if not isinstance(agent, dict) or not self.matches_gateway_binding(agent, client_id, subject):
            raise HTTPException(502, "Gateway did not confirm the requested binding; retry the same operation")
        return str(UUID(agent["agent_id"]))


def registration_context() -> httpx.Client:
    return httpx.Client(timeout=10, follow_redirects=False)


@app.post("/v1/agent-registrations")
def register(data: Registration, owner: str = Depends(operator)) -> dict:
    operation_id = str(data.operation_id)
    with operation_store() as db:
        try:
            db.execute(
                "INSERT INTO registrations(id, owner, name, state) VALUES (?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING",
                (operation_id, owner, data.name),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(409, "Reuse the operation ID for this Agent name") from exc
        row = load_operation(db, operation_id, owner)
        if row["name"] != data.name:
            raise HTTPException(409, "Operation ID is already in use")
    with operation_store() as db:
        row = load_operation(db, operation_id, owner)
        if row["state"] in ("active", "disabling", "disabled"):
            return operation_status(row)
        metadata = operation_status(row)
        try:
            with registration_context() as http:
                provision = Provisioner(http)
                internal, subject = provision.ensure_identity(metadata["client_id"])
                if row["subject"] is not None and row["subject"] != subject:
                    raise HTTPException(409, "The original workload subject was replaced")
                db.execute(
                    "UPDATE registrations SET state='identity_created', subject=? WHERE id=?", (subject, operation_id)
                )
                agent = provision.ensure_gateway_binding(metadata["client_id"], subject, row["gateway_agent_id"])
                db.execute(
                    "UPDATE registrations SET state='gateway_bound', gateway_agent_id=? WHERE id=?",
                    (agent, operation_id),
                )
                provision.keycloak("PUT", f"/clients/{internal}", json={"enabled": True}).raise_for_status()
                db.execute("UPDATE registrations SET state='active' WHERE id=?", (operation_id,))
        except (HTTPException, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            db.commit()
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(
                502, "Registration stopped at its last confirmed stage; retry the same operation"
            ) from None
        return operation_status(load_operation(db, operation_id, owner))


@app.get("/v1/agent-registrations/{operation_id}")
def status(operation_id: UUID, owner: str = Depends(operator)) -> dict:
    with operation_store() as db:
        return operation_status(load_operation(db, str(operation_id), owner))


@app.post("/v1/agent-registrations/{operation_id}/credential")
def claim_credential(operation_id: UUID, response: Response, owner: str = Depends(operator)) -> dict:
    response.headers["Cache-Control"] = "no-store"
    with operation_store() as db:
        row = load_operation(db, str(operation_id), owner)
        if row["state"] != "active" or row["credential_claimed"]:
            raise HTTPException(409, "A credential is unavailable for this registration")
        metadata = operation_status(row)
        try:
            with registration_context() as http:
                provision = Provisioner(http)
                identity = provision.find_identity(metadata["client_id"])
                if identity is None or not identity.get("enabled"):
                    raise HTTPException(409, "Workload identity is unavailable")
                internal = str(UUID(identity["id"]))
                account = provision.keycloak("GET", f"/clients/{internal}/service-account-user")
                account.raise_for_status()
                if account.json()["id"] != row["subject"]:
                    raise HTTPException(409, "The original workload subject was replaced")
                if provision.find_gateway_binding(metadata["client_id"], row["subject"]) != row["gateway_agent_id"]:
                    raise HTTPException(409, "The original gateway binding is unavailable")
                secret = provision.keycloak("GET", f"/clients/{internal}/client-secret")
                secret.raise_for_status()
                value = secret.json()["value"]
                if not isinstance(value, str) or not value:
                    raise ValueError("Empty credential")
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            raise HTTPException(502, "Workload credential could not be retrieved") from None
        db.execute("UPDATE registrations SET credential_claimed=1 WHERE id=?", (str(operation_id),))
        return {
            "issuer": metadata["issuer"],
            "client_id": metadata["client_id"],
            "subject": metadata["subject"],
            "client_secret": value,
            "scope": _SCOPE,
        }


@app.post("/v1/agent-registrations/{operation_id}/disable")
def disable(operation_id: UUID, owner: str = Depends(operator)) -> dict:
    key = str(operation_id)
    with operation_store() as db:
        row = load_operation(db, key, owner)
        if row["state"] == "disabled":
            return operation_status(row)
        if row["state"] not in ("active", "disabling"):
            raise HTTPException(409, "Registration is not active")
        db.execute("UPDATE registrations SET state='disabling' WHERE id=?", (key,))
    with operation_store() as db:
        row = load_operation(db, key, owner)
        if row["state"] == "disabled":
            return operation_status(row)
        try:
            with registration_context() as http:
                provision = Provisioner(http)
                agent_id = str(UUID(row["gateway_agent_id"]))
                gateway_reply = provision.gateway_request("PATCH", f"/v1/agents/{agent_id}", json={"enabled": False})
                gateway_reply.raise_for_status()
                gateway_state = gateway_reply.json()
                if gateway_state["agent_id"] != agent_id or gateway_state["enabled"] is not False:
                    raise HTTPException(502, "Gateway did not confirm disable; retry the same operation")
                identity = provision.find_identity(operation_status(row)["client_id"])
                if identity is not None:
                    provision.keycloak(
                        "PUT", f"/clients/{UUID(identity['id'])}", json={"enabled": False}
                    ).raise_for_status()
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            raise HTTPException(502, "Disable was not fully confirmed; retry the same operation") from None
        db.execute("UPDATE registrations SET state='disabled' WHERE id=?", (key,))
        return operation_status(load_operation(db, key, owner))
