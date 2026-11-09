"""Check that serving a checkout does not publish repository internals."""

import importlib.util
from functools import partial
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest


spec = importlib.util.spec_from_file_location("joseki_server", Path(__file__).resolve().parents[1] / "server.py")
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)


class QuietHandler(server_module.RevalidatingHandler):
    def log_message(self, *args):
        pass


class ServerPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = TemporaryDirectory()
        cls.root = Path(cls.temporary.name) / "site"
        cls.root.mkdir()
        files = {
            "index.html": "<title>Joseki</title>",
            "app.js": "window.ready = true;",
            "data/SOURCES.md": "Public source attribution",
            "assets/font.woff2": "font fixture",
            ".git/HEAD": "ref: refs/heads/main",
            ".git/config": "private repository configuration",
            ".env": "private configuration",
            "server.py": "server code",
            "scripts/build.py": "build script",
            "tests/test.cjs": "test fixture",
            "__pycache__/module.pyc": "bytecode fixture",
            "data/.private/file.txt": "private fixture",
        }
        for name, text in files.items():
            file = cls.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text)
        outside = Path(cls.temporary.name) / "outside.txt"
        outside.write_text("outside the served directory")
        (cls.root / "alias.txt").symlink_to(cls.root / ".git/config")
        (cls.root / "outside.txt").symlink_to(outside)
        (cls.root / "nested").mkdir()
        (cls.root / "nested/index.html").symlink_to(outside)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(cls.root)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temporary.cleanup()

    def request(self, path, method="GET", headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_public_assets_and_conditional_cache(self):
        for path in ("/", "/app.js?v=example", "/data/SOURCES.md", "/assets/font.woff2"):
            with self.subTest(path=path):
                status, headers, body = self.request(path)
                self.assertEqual(status, 200)
                self.assertTrue(body)
                self.assertEqual(headers["Server"], "Joseki")
                self.assertEqual(headers["Cache-Control"], "no-cache")
                status, headers, body = self.request(path, headers={"If-Modified-Since": headers["Last-Modified"]})
                self.assertEqual(status, 304)
                self.assertEqual(headers["Cache-Control"], "no-cache")
                self.assertEqual(body, b"")

    def test_private_paths_are_not_served(self):
        paths = (
            "/.git", "/.git/HEAD", "/%2egit/config", "/data/%2e%2e/.git/config",
            "/.env", "/server.py", "/scripts/build.py", "/tests/test.cjs",
            "/__pycache__/module.pyc", "/data/.private/file.txt",
        )
        for path in paths:
            for method in ("GET", "HEAD"):
                with self.subTest(path=path, method=method):
                    status, headers, body = self.request(path, method)
                    self.assertEqual(status, 404)
                    self.assertEqual(headers["Server"], "Joseki")
                    self.assertNotIn(str(self.root).encode(), body)

    def test_directory_indexes_and_symlinks_do_not_bypass_protection(self):
        for path in ("/assets/", "/data/", "/alias.txt", "/outside.txt", "/nested/"):
            with self.subTest(path=path):
                status, _, _ = self.request(path)
                self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
