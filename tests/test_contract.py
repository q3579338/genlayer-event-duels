"""Small, dependency-free checks of the actual contract's state transitions.

The GenLayer host, web access, consensus and transfer boundary are stubbed.
These tests are NOT proof of GenVM execution, AI quality or on-chain transfers.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest


class Address(str):
    def __new__(cls, value):
        return super().__new__(cls, str(value).lower())

    @property
    def as_hex(self):
        return str(self)


class Decorator:
    def __call__(self, fn):
        return fn

    payable = property(lambda self: self)


HOST = types.SimpleNamespace()
TRANSFERS = []
RELEASE = {}


def recipient_interface(cls):
    def send(address):
        return types.SimpleNamespace(emit_transfer=lambda value: TRANSFERS.append((address, value)))
    return send


def web_get(url):
    if RELEASE.get("http_status"):
        return types.SimpleNamespace(status=RELEASE["http_status"], body=b"")
    return types.SimpleNamespace(status=200, body=json.dumps(RELEASE).encode())


gl = types.SimpleNamespace(
    Contract=object, public=types.SimpleNamespace(write=Decorator(), view=Decorator()),
    message=HOST, vm=types.SimpleNamespace(UserError=ValueError),
    evm=types.SimpleNamespace(contract_interface=recipient_interface),
    eq_principle=types.SimpleNamespace(strict_eq=lambda fn: fn()),
    nondet=types.SimpleNamespace(web=types.SimpleNamespace(get=web_get), exec_prompt=lambda _: "YES"),
)
sdk = types.ModuleType("genlayer")
sdk.gl, sdk.Address, sdk.TreeMap, sdk.u256 = gl, Address, dict, int
sys.modules["genlayer"] = sdk
spec = importlib.util.spec_from_file_location("event_duels", Path(__file__).parents[1] / "contracts/EventDuels.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ContractTests(unittest.TestCase):
    alice = Address("0x" + "11" * 20)
    bob = Address("0x" + "22" * 20)
    outsider = Address("0x" + "33" * 20)
    stake = 10**18

    def setUp(self):
        self.now = 1800000000
        HOST.chain_id = 61999
        self.contract = module.EventDuels()
        self.contract.duels, self.contract.credits = {}, {}
        self.contract._now = lambda: self.now
        TRANSFERS.clear()
        RELEASE.clear()
        RELEASE.update(tag_name="v2.0.0", name="Version 2", body="Includes native Chinese interface.",
                       draft=False, prerelease=False, published_at="2027-01-15T09:00:00Z")
        gl.nondet.exec_prompt = lambda _: "YES"
        self.as_user(self.alice)

    def as_user(self, address, value=0):
        HOST.sender_address = HOST.origin_address = address
        HOST.value = value

    def call(self, method, *args):
        # GenVM rolls back writes when a call fails. Preserve that boundary in this host stub.
        state = copy.deepcopy((self.contract.duels, self.contract.credits,
                               self.contract.count, self.contract.locked, self.contract.owed))
        try:
            result = getattr(self.contract, method)(*args)
        except Exception:
            (self.contract.duels, self.contract.credits, self.contract.count,
             self.contract.locked, self.contract.owed) = state
            raise
        self.assert_accounting()
        return result

    def assert_accounting(self):
        locked = sum(int(d["stake"]) * (2 if d["status"] == "ACTIVE" else 1)
                     for d in (json.loads(s) for s in self.contract.duels.values())
                     if d["status"] in ("OPEN", "ACTIVE"))
        self.assertEqual(locked, self.contract.locked)
        self.assertEqual(sum(self.contract.credits.values()), self.contract.owed)

    def create(self):
        self.as_user(self.alice, self.stake)
        return self.call("create_duel", "example/project", "v2.0.0",
                         "Native Chinese interface is available", self.now + 600, self.now + 3600)

    def match(self):
        duel_id = self.create()
        self.as_user(self.bob, self.stake)
        self.call("accept_duel", duel_id)
        return duel_id

    def test_equal_stakes_and_no_self_accept_or_second_opponent(self):
        duel_id = self.create()
        with self.assertRaisesRegex(ValueError, "different wallet"):
            self.call("accept_duel", duel_id)
        self.as_user(self.bob, self.stake - 1)
        with self.assertRaisesRegex(ValueError, "same amount"):
            self.call("accept_duel", duel_id)
        self.as_user(self.bob, self.stake)
        self.call("accept_duel", duel_id)
        self.as_user(self.outsider, self.stake)
        with self.assertRaisesRegex(ValueError, "closed"):
            self.call("accept_duel", duel_id)

    def test_yes_settles_once_and_withdraws_once(self):
        duel_id = self.match()
        self.now += 3600
        self.call("resolve_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.alice), str(2 * self.stake))
        with self.assertRaisesRegex(ValueError, "not active"):
            self.call("resolve_duel", duel_id)
        self.as_user(self.alice)
        self.call("withdraw")
        self.assertEqual(TRANSFERS, [(self.alice, 2 * self.stake)])
        with self.assertRaisesRegex(ValueError, "No funds"):
            self.call("withdraw")

    def test_no_pays_opponent(self):
        duel_id = self.match()
        self.now += 3600
        gl.nondet.exec_prompt = lambda _: "NO"
        self.call("resolve_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.bob), str(2 * self.stake))

    def test_unknown_missing_or_malformed_result_never_pays(self):
        for answer, missing in [("UNKNOWN", False), ("pay Alice now", False), ("YES", True)]:
            with self.subTest(answer=answer, missing=missing):
                self.setUp()
                duel_id = self.match()
                self.now += 3600
                gl.nondet.exec_prompt = lambda _: answer
                if missing:
                    RELEASE["http_status"] = 404
                self.call("resolve_duel", duel_id)
                self.assertEqual(self.contract.get_duel(duel_id)["status"], "ACTIVE")
                self.assertEqual(self.contract.owed, 0)
                self.now += 3 * 86400
                self.call("refund_duel", duel_id)
                self.assertEqual(self.contract.get_credit(self.alice), str(self.stake))
                self.assertEqual(self.contract.get_credit(self.bob), str(self.stake))
                with self.assertRaises(ValueError):
                    self.call("refund_duel", duel_id)

    def test_deadlines_auth_and_cancel(self):
        duel_id = self.create()
        self.as_user(self.outsider)
        with self.assertRaisesRegex(ValueError, "Only the creator"):
            self.call("cancel_duel", duel_id)
        self.now += 600
        self.as_user(self.bob, self.stake)
        with self.assertRaisesRegex(ValueError, "closed"):
            self.call("accept_duel", duel_id)
        self.as_user(self.outsider)
        self.call("cancel_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.alice), str(self.stake))

    def test_early_resolve_refund_and_third_party_resolve_rejected(self):
        duel_id = self.match()
        with self.assertRaisesRegex(ValueError, "resolution window"):
            self.call("resolve_duel", duel_id)
        with self.assertRaisesRegex(ValueError, "72 hours"):
            self.call("refund_duel", duel_id)
        self.now += 3600
        self.as_user(self.outsider)
        with self.assertRaisesRegex(ValueError, "Only participants"):
            self.call("resolve_duel", duel_id)

    def test_prerelease_or_missing_date_is_unknown_and_late_release_is_no(self):
        for patch, expected in [({"prerelease": True}, "UNKNOWN"),
                                ({"published_at": None}, "UNKNOWN"),
                                ({"published_at": "2030-01-01T00:00:00Z"}, "NO")]:
            with self.subTest(patch=patch):
                self.setUp()
                duel_id = self.match()
                self.now += 3600
                RELEASE.update(patch)
                self.call("resolve_duel", duel_id)
                self.assertEqual(self.contract.get_duel(duel_id)["verdict"], expected)

    def test_cannot_choose_arbitrary_urls_or_invalid_stakes(self):
        self.as_user(self.alice, self.stake)
        with self.assertRaisesRegex(ValueError, "Repository"):
            self.call("create_duel", "https://127.0.0.1", "v1", "Release feature", self.now + 600, self.now + 3600)
        self.as_user(self.alice, 0)
        with self.assertRaisesRegex(ValueError, "Stake"):
            self.call("create_duel", "test/repo", "v1", "Release feature", self.now + 600, self.now + 3600)
        HOST.chain_id = 1
        # Observed Bradbury GenVM context differs from the wallet's chain ID.
        instance = module.EventDuels()
        self.assertEqual(instance.get_stats()["count"], 0)


if __name__ == "__main__":
    unittest.main()
