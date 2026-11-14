"""Offline configuration contract; no Docker, imports of LiteLLM, or networking."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def validate(compose, proxy, key):
    assert compose['name'] == 'ai-tagent-gateway-dev'
    assert set(compose['services']) == {'gateway', 'db'}
    assert compose['networks'] == {'isolated': {'internal': True}}
    gateway, db = compose['services']['gateway'], compose['services']['db']
    assert gateway['ports'] == ['127.0.0.1:4400:4000']
    assert 'ports' not in db
    for service in (gateway, db):
        assert service['networks'] == ['isolated']
        assert service['pull_policy'] == 'never'
        assert ':?' in service['image']
        assert not any(k in service for k in ('privileged', 'network_mode', 'env_file', 'build'))
    env = gateway['environment']
    assert set(env) == {'DATABASE_URL', 'LITELLM_MASTER_KEY', 'UI_USERNAME', 'UI_PASSWORD',
                        'LITELLM_TELEMETRY_DISABLED', 'LITELLM_OFFLINE_MODE', 'LITELLM_LOCAL_MODEL_COST_MAP'}
    for k in ('LITELLM_TELEMETRY_DISABLED', 'LITELLM_OFFLINE_MODE', 'LITELLM_LOCAL_MODEL_COST_MAP'):
        assert env[k] == 'true'
    for k in ('LITELLM_MASTER_KEY', 'UI_PASSWORD', 'DATABASE_URL'):
        assert ':?' in env[k] and ':-' not in env[k]
    assert ':?' in db['environment']['POSTGRES_PASSWORD']
    assert gateway['volumes'] == ['./proxy_config.json:/app/dev_proxy_config.json:ro']
    assert db['volumes'] == ['dev_database:/var/lib/postgresql/data']
    assert compose['volumes'] == {'dev_database': {}}
    assert proxy['general_settings'] == {'master_key': 'os.environ/LITELLM_MASTER_KEY',
        'store_model_in_db': False, 'store_prompts_in_spend_logs': False, 'disable_spend_logs': True}
    assert proxy['litellm_settings'] == {'turn_off_message_logging': True,
                                       'success_callback': [], 'failure_callback': []}
    assert len(proxy['model_list']) == 1
    model = proxy['model_list'][0]
    assert model['model_name'] == 'dev-mock'
    assert set(model['litellm_params']) == {'model', 'mock_response'}
    assert model['litellm_params']['mock_response']
    assert key['key_type'] == 'llm_api' and key['models'] == ['dev-mock']
    assert key['duration'] == '1h' and 0 < key['max_budget'] <= 1
    assert key['rpm_limit'] == 10 and key['tpm_limit'] == 1000


def load():
    return tuple(json.loads((ROOT / name).read_text()) for name in
                 ('compose.json', 'proxy_config.json', 'inference-key-request.json'))


if __name__ == '__main__':
    validate(*load())
    print('PASS: static isolated-dev contract only; runtime and network isolation not tested.')
