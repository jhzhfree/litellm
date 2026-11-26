import os
import secrets
from pathlib import Path

target = Path(__file__).resolve().parent / '.env'
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write('COMPOSE_PROJECT_NAME=ai-gw-offline\n')
    stream.write('BIND_ADDRESS=127.0.0.1\nCORE_PORT=4400\nMONITOR_PORT=9190\n')
    stream.write('UI_USERNAME=dev-admin\n')
    for name, prefix in [('LITELLM_MASTER_KEY', 'sk-'), ('UI_PASSWORD', ''), ('DB_PASSWORD', '')]:
        stream.write(f'{name}={prefix}{secrets.token_hex(32)}\n')
print('Created .env with mode 0600; existing files are never overwritten.')
