"""Security regression tests for passive, secret-isolated scan inputs."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    'sanitize', Path(__file__).parents[1] / 'ci/sonar/sanitize.py'
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SanitizeTests(unittest.TestCase):
    def test_relative_paths(self):
        for path in ('../evil', '/etc/passwd', 'src/../../x', 'src\\x', 'src//x', 'src/./x'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                MODULE.safe_relative(path)

    def test_lcov_rejects_foreign_sources(self):
        for path in ('/etc/passwd', '../src/a.ts', 'tests/a.ts'):
            with self.assertRaises(ValueError):
                MODULE.validate_lcov(f'SF:{path}\nend_of_record\n'.encode())

    def test_lcov_accepts_normal_report(self):
        MODULE.validate_lcov(b'TN:\nSF:src/a.ts\nDA:1,2\nLF:1\nLH:1\nend_of_record\n')

    def test_xml_rejects_entities_and_paths(self):
        with self.assertRaises(ValueError):
            MODULE.validate_xml(b'<!DOCTYPE coverage><coverage/>')
        with self.assertRaises(ValueError):
            MODULE.validate_xml(b'<coverage><class filename="../x.py"/></coverage>')

    def test_xml_normalizes_source(self):
        output = MODULE.validate_xml(b'<coverage><sources><source>/runner/evil</source></sources><class filename="scripts/check_compose_ports.py"/></coverage>')
        self.assertNotIn(b'/runner/evil', output)

    def test_source_symlink_rejected_and_properties_excluded(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / 'pr'
            for name in MODULE.SOURCE_ROOTS:
                (root / name).mkdir(parents=True)
            (root / 'scripts/sonar-project.properties').write_text('sonar.host.url=https://evil.invalid')
            MODULE.copy_sources(root, Path(temporary) / 'scan')
            self.assertFalse((Path(temporary) / 'scan/scripts/sonar-project.properties').exists())
            (root / 'scripts/evil').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError):
                MODULE.copy_sources(root, Path(temporary) / 'scan2')

    def test_artifact_rejects_extra_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'input.zip'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr('evil.sh', 'echo bad')
            with self.assertRaises(ValueError):
                MODULE.extract_coverage(archive, Path(temporary) / 'scan')

    def test_artifact_requires_both_reports(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'input.zip'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr('backend-lcov.info', 'SF:src/a.ts\nDA:1,1\nend_of_record\n')
            with self.assertRaises(ValueError):
                MODULE.extract_coverage(archive, Path(temporary) / 'scan')


if __name__ == '__main__':
    unittest.main()
