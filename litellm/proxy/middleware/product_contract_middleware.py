import json
from collections.abc import Mapping
from typing import Final
from urllib.parse import parse_qsl, urlencode

from pydantic import JsonValue, TypeAdapter
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from litellm.proxy.common_utils.product_contract import (
    FIELD_NAMES,
    INTERNAL_FIELDS,
    internal_header,
    internal_path,
    product_description,
    public_header,
    public_path,
    public_schema,
    translate_enum_value,
    translate_fields,
)

JSON: Final = TypeAdapter[JsonValue](JsonValue)
HEADERS: Final = TypeAdapter[tuple[tuple[bytes, bytes], ...]](tuple[tuple[bytes, bytes], ...])
STRING: Final = TypeAdapter[str](str)
BYTES: Final = TypeAdapter[bytes](bytes)
INTEGER: Final = TypeAdapter[int](int)
PASSTHROUGH_PREFIXES: Final = ("/plugin-proxy/", "/mcp", "/a2a/")


def error_payload(value: JsonValue) -> JsonValue:
    if isinstance(value, list):
        return [error_payload(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: product_description(item)
        if key in {"message", "detail"} and isinstance(item, str) and "litellm" in item.lower()
        else [FIELD_NAMES.get(part, part) if isinstance(part, str) else part for part in item]
        if key == "loc" and isinstance(item, list)
        else error_payload(item)
        if isinstance(item, (dict, list)) and key not in {"input", "ctx"}
        else item
        for key, item in value.items()
    }


class ProductContractMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        scope_data: Final[Mapping[str, object]] = scope
        original_path: Final = STRING.validate_python(scope_data["path"])
        path: Final = internal_path(original_path)
        incoming_headers: Final = HEADERS.validate_python(scope_data.get("headers", ()))
        public_header_names: Final = frozenset(name for name, _ in incoming_headers)
        headers: Final = [
            (internal_header(name.decode("latin-1")).encode("latin-1"), value)
            for name, value in incoming_headers
            if public_header(name.decode("latin-1")).encode("latin-1") not in public_header_names
            or not name.startswith(b"x-litellm-")
        ]
        original_query: Final = BYTES.validate_python(scope_data.get("query_string", b""))
        query_items: Final = parse_qsl(original_query.decode("latin-1"), keep_blank_values=True)
        translated_query_items: Final = [
            (INTERNAL_FIELDS.get(key, key), translate_enum_value(key, value, incoming=True))
            for key, value in query_items
        ]
        query: Final = urlencode(translated_query_items).encode()
        translated_scope: Final[Scope] = {
            **scope,
            "path": path,
            "raw_path": path.encode()
            if path != original_path
            else BYTES.validate_python(scope_data.get("raw_path", path.encode())),
            "headers": headers,
            "query_string": query if translated_query_items != query_items else original_query,
        }
        passthrough: Final = path.startswith(PASSTHROUGH_PREFIXES)
        request: Final = Request(translated_scope, receive)
        request_is_json: Final = "application/json" in request.headers.get("content-type", "") and not passthrough
        response: Final = _ProductResponse(send, path, passthrough)
        if not request_is_json:
            await self.app(translated_scope, receive, response.send)
            return
        raw: Final = await request.body()
        if not raw:
            await self.app(translated_scope, _BodyReplay(raw, receive).receive, response.send)
            return
        try:
            payload: Final = JSON.validate_json(raw)
        except ValueError:
            await JSONResponse(
                {"error": {"message": "Invalid JSON request body", "type": "invalid_request_error"}},
                status_code=400,
            )(scope, receive, send)
            return
        encoded: Final = json.dumps(translate_fields(payload, incoming=True), ensure_ascii=False).encode()
        body_scope: Final[Scope] = {
            **translated_scope,
            "headers": [(key, value) for key, value in headers if key != b"content-length"]
            + [(b"content-length", str(len(encoded)).encode())],
        }
        await self.app(body_scope, _BodyReplay(encoded, receive).receive, response.send)


class _BodyReplay:
    def __init__(self, body: bytes, upstream: Receive) -> None:
        self.body = body
        self.upstream = upstream
        self.consumed = False

    async def receive(self) -> Message:
        if self.consumed:
            return await self.upstream()
        self.consumed = True
        return {"type": "http.request", "body": self.body, "more_body": False}


def _response_body(body: bytes, path: str, status: int) -> bytes:
    try:
        data: Final = JSON.validate_json(body)
    except ValueError:
        return body
    public_data: Final = public_schema(data) if path.endswith("/openapi.json") else translate_fields(data)
    result: Final = error_payload(public_data) if status >= 400 else public_data
    return json.dumps(result, ensure_ascii=False).encode()


def _event_line(line: bytes) -> bytes:
    if not line.startswith(b"data:") or line[5:].strip() == b"[DONE]":
        return line
    try:
        value: Final = JSON.validate_json(line[5:].strip())
    except ValueError:
        return line
    renamed: Final = translate_fields(value)
    result: Final = error_payload(renamed) if isinstance(value, dict) and "error" in value else renamed
    return b"data: " + json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()


class _ProductResponse:
    def __init__(self, downstream: Send, path: str, passthrough: bool) -> None:
        self.downstream = downstream
        self.path = path
        self.passthrough = passthrough
        self.start: Message | None = None
        self.chunks: tuple[bytes, ...] = ()
        self.status = 200
        self.rewrite_json = False
        self.rewrite_events = False
        self.event_tail = b""

    async def send(self, message: Message) -> None:
        message_data: Final[Mapping[str, object]] = message
        if message["type"] == "http.response.start":
            response_headers: Final = HEADERS.validate_python(message_data.get("headers", ()))
            self.rewrite_json = (
                not self.passthrough
                and any(key == b"content-type" and b"application/json" in value for key, value in response_headers)
                and not any(key == b"content-encoding" for key, _ in response_headers)
            )
            self.rewrite_events = (
                not self.passthrough
                and any(key == b"content-type" and b"text/event-stream" in value for key, value in response_headers)
                and not any(key == b"content-encoding" for key, _ in response_headers)
            )
            renamed: Final = [
                (
                    public_header(key.decode("latin-1")).encode("latin-1"),
                    value.replace(b"x-litellm-", b"x-ai-gateway-")
                    if key in {b"access-control-expose-headers", b"access-control-allow-headers"}
                    else public_path(value.decode("latin-1")).encode("latin-1")
                    if key == b"location"
                    else value,
                )
                for key, value in response_headers
            ]
            self.status = INTEGER.validate_python(message_data["status"])
            self.start = {**message, "headers": renamed}
            if not self.rewrite_json:
                await self.downstream(self.start)
            return
        if message["type"] == "http.response.body" and self.rewrite_events:
            lines: Final = (self.event_tail + BYTES.validate_python(message_data.get("body", b""))).split(b"\n")
            pending: Final = message_data.get("more_body", False) is True
            self.event_tail = lines[-1] if pending else b""
            complete: Final = lines[:-1] if pending else lines
            data: Final = b"\n".join(_event_line(line) for line in complete)
            await self.downstream({**message, "body": data + (b"\n" if pending and complete else b"")})
            return
        if message["type"] != "http.response.body" or not self.rewrite_json:
            await self.downstream(message)
            return
        self.chunks = (*self.chunks, BYTES.validate_python(message_data.get("body", b"")))
        if message_data.get("more_body", False) is True:
            return
        assert self.start is not None
        output: Final = _response_body(b"".join(self.chunks), self.path, self.status)
        await self.downstream(
            {
                **self.start,
                "headers": [
                    (key, value)
                    for key, value in HEADERS.validate_python(self.start.get("headers", ()))
                    if key not in {b"content-length", b"etag"}
                ]
                + [(b"content-length", str(len(output)).encode())],
            }
        )
        await self.downstream({**message, "body": output})
