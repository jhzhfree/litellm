"""Validate a local identity deployment without printing credentials or tokens."""
import json
import asyncio
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from uuid import uuid4

BASE = 'http://127.0.0.1:18080'


def request(path, data=None, token=None, form=False, method=None):
    headers = {'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = None if data is None else (urllib.parse.urlencode(data) if form else json.dumps(data)).encode()
    with urllib.request.urlopen(urllib.request.Request(BASE + path, data=body, headers=headers, method=method), timeout=15) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def main():
    env = dict(line.split('=', 1) for line in Path(__file__).with_name('.env').read_text().splitlines() if '=' in line)
    discovery = request('/realms/company/.well-known/openid-configuration')
    assert discovery['issuer'] == BASE + '/realms/company'
    token = request('/realms/master/protocol/openid-connect/token', {
        'grant_type': 'password', 'client_id': 'admin-cli', 'username': 'admin',
        'password': env['IDENTITY_ADMIN_PASSWORD'],
    }, form=True)['access_token']
    name = 'integration-' + uuid4().hex
    root = '/admin/realms/company'
    request(root + '/users', {'username': name, 'enabled': True}, token)
    users = request(root + '/users?username=' + name + '&exact=true', token=token)
    assert len(users) == 1
    request(root + '/clients', {
        'clientId': name, 'enabled': True, 'protocol': 'openid-connect',
        'serviceAccountsEnabled': True, 'standardFlowEnabled': False,
        'directAccessGrantsEnabled': False, 'publicClient': False,
        'protocolMappers': [{
            'name': 'gateway-audience', 'protocol': 'openid-connect',
            'protocolMapper': 'oidc-audience-mapper',
            'config': {'included.custom.audience': 'ai-governance-gateway',
                       'access.token.claim': 'true', 'id.token.claim': 'false'},
        }],
    }, token)
    clients = request(root + '/clients?clientId=' + name, token=token)
    assert len(clients) == 1
    client_id = clients[0]['id']
    try:
        secret = request(root + '/clients/' + client_id + '/client-secret', token=token)['value']
        result = request('/realms/company/protocol/openid-connect/token', {
            'grant_type': 'client_credentials', 'client_id': name, 'client_secret': secret,
        }, form=True)
        assert result['access_token'] and result['token_type'].lower() == 'bearer'
        if '--gateway-jwt' in sys.argv:
            asyncio.run(verify_gateway_jwt(result['access_token']))
        request(root + '/users/' + users[0]['id'], {'enabled': False}, token, method='PUT')
        assert request(root + '/users/' + users[0]['id'], token=token)['enabled'] is False
        print('PASS discovery, user create/read/disable, application registration, client credentials issuance')
    finally:
        request(root + '/clients/' + client_id, token=token, method='DELETE')
        request(root + '/users/' + users[0]['id'], token=token, method='DELETE')


async def verify_gateway_jwt(token):
    from litellm.caching.dual_cache import DualCache
    from litellm.proxy._types import LiteLLM_JWTAuth
    from litellm.proxy.auth.handle_jwt import JWTHandler

    issuer = BASE + '/realms/company'
    for audience, should_accept in [('ai-governance-gateway', True), ('wrong-product', False)]:
        handler = JWTHandler()
        handler.update_environment(
            prisma_client=None, user_api_key_cache=DualCache(),
            litellm_jwtauth=LiteLLM_JWTAuth(issuers=[{
                'issuer': issuer, 'audience': audience,
                'jwks_url': issuer + '/protocol/openid-connect/certs',
            }]),
        )
        try:
            try:
                claims = await handler.auth_jwt(token)
            except Exception:
                if should_accept:
                    raise
                print('PASS gateway JWT rejects wrong audience')
            else:
                assert should_accept, 'Gateway accepted wrong audience'
                assert claims['iss'] == issuer and claims['sub']
                print('PASS gateway JWT verifies live Keycloak signature and claims')
        finally:
            await handler.close()


if __name__ == '__main__':
    main()
