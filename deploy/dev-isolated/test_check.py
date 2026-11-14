import copy
import os
from pathlib import Path
import tempfile
import unittest
from check import load, validate
from init_env import initialize


class IsolationContract(unittest.TestCase):
    def test_baseline(self):
        validate(*load())

    def test_reject_unsafe_mutations(self):
        mutations = [
            lambda c, p, k: c['services']['gateway']['ports'].__setitem__(0, '4400:4000'),
            lambda c, p, k: c['services']['db'].__setitem__('ports', ['5432:5432']),
            lambda c, p, k: c['networks']['isolated'].__setitem__('internal', False),
            lambda c, p, k: c['services']['gateway']['environment'].__setitem__('LITELLM_MASTER_KEY', 'sk-default'),
            lambda c, p, k: c['services']['gateway']['environment'].__setitem__('LITELLM_TELEMETRY_DISABLED', 'false'),
            lambda c, p, k: p['general_settings'].__setitem__('store_prompts_in_spend_logs', True),
            lambda c, p, k: p['litellm_settings'].__setitem__('success_callback', ['external']),
            lambda c, p, k: p['model_list'][0]['litellm_params'].__setitem__('api_key', 'real-key'),
            lambda c, p, k: k.__setitem__('key_type', 'management'),
        ]
        for mutate in mutations:
            data = copy.deepcopy(load())
            mutate(*data)
            with self.assertRaises(AssertionError):
                validate(*data)

    def test_private_unique_secrets_and_no_overwrite(self):
        # Disposable synthetic test files only, never repository/runtime credentials.
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'env'
            initialize(path)
            original = path.read_bytes()
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            values = dict(line.split('=', 1) for line in original.decode().splitlines()
                          if line and not line.startswith('#'))
            self.assertEqual(len({values[k] for k in ('DEV_MASTER_KEY', 'DEV_UI_PASSWORD', 'DEV_DB_PASSWORD')}), 3)
            with self.assertRaises(FileExistsError):
                initialize(path)
            self.assertEqual(path.read_bytes(), original)
            symlink = Path(folder) / 'link'
            os.symlink(path, symlink)
            with self.assertRaises(FileExistsError):
                initialize(symlink)


if __name__ == '__main__':
    unittest.main()
