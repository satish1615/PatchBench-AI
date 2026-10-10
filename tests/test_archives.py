"""Check reproducibility and safety of checked-in example archives."""
import unittest
import zipfile
from pathlib import Path

EXAMPLES = Path(__file__).resolve().parents[1] / 'examples'

class ArchiveChecks(unittest.TestCase):
    def test_valid_archive_has_required_structure(self):
        with zipfile.ZipFile(EXAMPLES / 'valid-task.zip') as z:
            names = set(z.namelist())
            self.assertTrue({'task.json', 'states/before/client.py', 'states/after/client.py'}.issubset(names))
            self.assertIsNone(z.testzip())

    def test_broken_archive_has_manifest(self):
        with zipfile.ZipFile(EXAMPLES / 'broken-task.zip') as z:
            self.assertIn('task.json', z.namelist())

    def test_security_fixture_contains_traversal(self):
        with zipfile.ZipFile(EXAMPLES / 'unsafe-traversal.zip') as z:
            self.assertIn('../secrets.txt', z.namelist())

if __name__ == '__main__':
    unittest.main()
