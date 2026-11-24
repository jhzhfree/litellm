"""Manage an Agent registration through the identity-platform control API."""

import argparse
import json
import os
import stat
import sys
from urllib.parse import urlsplit
from uuid import UUID

import httpx


def trusted_url(value: str) -> str:
    url = urlsplit(value)
    if (
        not url.hostname
        or url.username is not None
        or url.query
        or url.fragment
        or (url.scheme != "https" and not (url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}))
    ):
        raise ValueError("Use a trusted HTTPS URL or loopback HTTP")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("register", "status", "credential", "disable"):
        subcommand = commands.add_parser(command)
        subcommand.add_argument("operation_id", type=UUID)
        if command == "register":
            subcommand.add_argument("--name", required=True)
        if command == "credential":
            subcommand.add_argument("--secret-file", required=True)
    args = parser.parse_args()
    try:
        url = trusted_url(args.platform).rstrip("/") + "/v1/agent-registrations"
        path = f"{url}/{args.operation_id}"
        headers = {"Authorization": "Bearer " + os.environ["AGENTCTL_OPERATOR_TOKEN"]}
        with httpx.Client(timeout=120, follow_redirects=False, headers=headers) as client:
            if args.command == "credential":
                # Reserve a new private file before consuming the one-time response.
                fd = os.open(args.secret_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.S_IRUSR | stat.S_IWUSR)
                with os.fdopen(fd, "w", encoding="utf-8") as output:
                    response = client.post(path + "/credential")
                    response.raise_for_status()
                    json.dump(response.json(), output)
                    output.write("\n")
                    output.flush()
                    os.fsync(output.fileno())
                sys.stdout.write("Credential saved to the private file.\n")
                return
            if args.command == "register":
                response = client.post(url, json={"operation_id": str(args.operation_id), "name": args.name})
            elif args.command == "disable":
                response = client.post(path + "/disable")
            else:
                response = client.get(path)
            response.raise_for_status()
            sys.stdout.write(json.dumps(response.json(), indent=2) + "\n")
    except httpx.HTTPStatusError as exc:
        raise SystemExit(
            f"Identity platform returned HTTP {exc.response.status_code}; check operation status."
        ) from None
    except (httpx.RequestError, OSError, ValueError, KeyError):
        raise SystemExit(
            "Operation could not be confirmed. Check platform configuration and operation status."
        ) from None


if __name__ == "__main__":
    main()
