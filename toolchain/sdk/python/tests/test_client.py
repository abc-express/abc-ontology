import unittest
from daemon_sdk import DaemonClient


class TestDaemonClient(unittest.TestCase):
    def test_builds_health_url(self):
        client = DaemonClient(base_url="http://127.0.0.1:3000")
        self.assertTrue(client.base_url.endswith("3000"))


if __name__ == "__main__":
    unittest.main()
