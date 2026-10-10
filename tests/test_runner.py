"""Check the reference fixture's actual before/after behavior using pytest.
CI installs pytest in the QA host. This test runs original trusted fixtures only.
"""
import os
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

ARCHIVE=Path(__file__).resolve().parents[1]/'examples'/'valid-task.zip'

class TestReferenceTaskRunner(unittest.TestCase):
    def run_state(self, state):
        with tempfile.TemporaryDirectory() as d:
            with zipfile.ZipFile(ARCHIVE) as z:
                z.extractall(d)
            env=dict(os.environ,STATE=state, PYTHONPATH=d)
            return subprocess.run(['sh','test.sh'],cwd=d,env=env,capture_output=True,text=True,timeout=15)

    def test_before_has_one_expected_failure(self):
        r=self.run_state('before')
        self.assertNotEqual(r.returncode,0)
        self.assertIn('1 failed, 2 passed',r.stdout)

    def test_after_passes_all_three(self):
        r=self.run_state('after')
        self.assertEqual(r.returncode,0,msg=r.stdout+'\n'+r.stderr)
        self.assertIn('3 passed',r.stdout)

if __name__=='__main__':unittest.main()
