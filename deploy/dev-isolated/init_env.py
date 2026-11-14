"""Explicit opt-in only: create development-only credentials, never print them."""
import os
import secrets
from pathlib import Path


def initialize(path):
    # O_EXCL also rejects symlinks and guarantees existing files are never replaced.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write('# Development only. Never use or copy production credentials.\n')
        for name, prefix in [('DEV_MASTER_KEY', 'sk-'), ('DEV_UI_PASSWORD', ''),
                             ('DEV_DB_PASSWORD', '')]:
            stream.write(f'{name}={prefix}{secrets.token_hex(32)}\n')
        stream.write('DEV_UI_USERNAME=dev-admin\n')
        stream.write('DEV_GATEWAY_IMAGE=\nDEV_POSTGRES_IMAGE=\n')


if __name__ == '__main__':
    initialize(Path(__file__).with_name('.env'))
    print('Created private development .env; set reviewed local image digests before use.')
