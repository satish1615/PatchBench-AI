"""End-to-end behavior checks for original demonstration benchmark tasks.

This is a trusted test fixture extracted into a temporary directory. The web app
never executes uploaded code. Do not apply this harness to untrusted packages.
"""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile

EXAMPLE = Path(__file__).resolve().parents[1] / 'examples' / 'valid-task.zip'

@unittest.skipUnless(importlib.util.find_spec('pytest'), 'pytest is required for behavior verification')
class ReferenceBehavior(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='patchbench-fixture-')
        cls.path = Path(cls.temp.name)
        # This archive is generated and owned by this repository, never a user upload.
        with ZipFile(EXAMPLE) as archive:
            archive.extractall(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_suite(self, state, suite):
        env = os.environ.copy()
        env['PYTHONPATH'] = str(self.path / 'states' / state)
        result = subprocess.run(
            [sys.executable, '-m', 'pytest', '-q', '-p', 'no:cacheprovider', suite],
            cwd=self.path, env=env, capture_output=True, text=True, timeout=25,
        )
        return result

    def test_before_fail_to_pass_fails(self):
        outcome = self.run_suite('before', 'tests/fail2pass')
        self.assertEqual(outcome.returncode, 1, outcome.stdout + outcome.stderr)
        self.assertIn('1 failed', outcome.stdout)

    def test_before_preservation_passes(self):
        outcome = self.run_suite('before', 'tests/pass2pass')
        self.assertEqual(outcome.returncode, 0, outcome.stdout + outcome.stderr)
        self.assertIn('2 passed', outcome.stdout)

    def test_after_both_suites_pass(self):
        outcome = self.run_suite('after', 'tests')
        self.assertEqual(outcome.returncode, 0, outcome.stdout + outcome.stderr)
        self.assertIn('3 passed', outcome.stdout)

if __name__ == '__main__':
    unittest.main()
