import unittest

import localenv


def ip_hits(text):
    lines = text.splitlines()
    return [lines[ln - 1][s:e] for ln, s, e, c, _ in localenv.scan(text) if c == "IP"]


class TestIPPrecision(unittest.TestCase):
    def test_version_string_in_prose_is_not_flagged_as_ip(self):
        # 1.2.3.4 is shaped like an IP but here it's a version — must not be flagged.
        self.assertEqual(ip_hits("a bug where 1.2.3.4 was parsed as a date"), [])

    def test_bare_public_dotted_quad_without_context_is_left_to_the_model(self):
        self.assertEqual(ip_hits("we hit 9.4.10.2 throughput on the run"), [])

    def test_private_ip_is_always_flagged(self):
        self.assertEqual(ip_hits("worker at 10.0.3.21"), ["10.0.3.21"])

    def test_public_ip_with_network_context_is_flagged(self):
        self.assertEqual(ip_hits("ssh to 203.0.113.5 to deploy"), ["203.0.113.5"])

    def test_dotted_quad_with_a_port_is_flagged(self):
        self.assertEqual(ip_hits("db at 198.51.100.7:5432"), ["198.51.100.7"])


if __name__ == "__main__":
    unittest.main()
