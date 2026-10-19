"""Deposit-first candidate checks. Host, AI and transfers are stubs."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from test_contract import Address, HOST, RELEASE, TRANSFERS, gl

spec = importlib.util.spec_from_file_location("candidate", Path(__file__).parents[1] / "contracts/candidates/EventDuels.py")
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)

class CandidateTests(unittest.TestCase):
    alice = Address("0x" + "11" * 20)
    bob = Address("0x" + "22" * 20)
    outsider = Address("0x" + "33" * 20)
    stake = 10**15

    def setUp(self):
        self.now = 1800000000
        self.contract = candidate.EventDuels()
        self.contract.duels, self.contract.credits = {}, {}
        self.contract._now = lambda: self.now
        TRANSFERS.clear()
        RELEASE.clear()
        RELEASE.update(tag_name="v2", name="Release", body="CSV export is available.",
                       draft=False, prerelease=False, published_at="2027-01-15T09:00:00Z")
        gl.nondet.exec_prompt = lambda _: "YES"
        self.as_user(self.alice)

    def as_user(self, who, value=0, origin=None):
        HOST.sender_address, HOST.origin_address, HOST.value = who, origin or who, value

    def call(self, method, *args):
        state = copy.deepcopy((self.contract.duels, self.contract.credits,
                               self.contract.count, self.contract.locked, self.contract.owed))
        try:
            result = getattr(self.contract, method)(*args)
        except Exception:
            (self.contract.duels, self.contract.credits, self.contract.count,
             self.contract.locked, self.contract.owed) = state
            raise
        locked = sum(int(d["stake"]) * (2 if d["status"] == "ACTIVE" else 1)
                     for d in map(json.loads, self.contract.duels.values())
                     if d["status"] in ("OPEN", "ACTIVE"))
        self.assertEqual(locked, self.contract.locked)
        self.assertEqual(sum(self.contract.credits.values()), self.contract.owed)
        return result

    def fund(self, who, amount=None):
        self.as_user(who, self.stake if amount is None else amount)
        self.call("deposit")
        self.as_user(who)

    def create(self):
        self.fund(self.alice)
        return self.call("create_duel", "test/repo", "v2", "CSV export is available",
                         self.now + 600, self.now + 3600, str(self.stake))

    def match(self):
        duel_id = self.create()
        self.fund(self.bob)
        self.call("accept_duel", duel_id)
        return duel_id

    def test_deposit_credits_immediate_sender_without_origin_auth(self):
        self.as_user(self.alice, self.stake, self.outsider)
        self.assertEqual(self.call("deposit"), str(self.stake))
        self.assertEqual(self.contract.get_credit(self.alice), str(self.stake))
        self.assertEqual(self.contract.get_credit(self.outsider), "0")

    def test_invalid_create_preserves_credit_and_withdraws_to_same_sender(self):
        self.fund(self.alice)
        for repo, acceptance, amount in [("https://evil.invalid", self.now + 600, str(self.stake)),
                                          ("test/repo", self.now, str(self.stake)),
                                          ("test/repo", self.now + 600, "1")]:
            with self.subTest(repo=repo, amount=amount):
                with self.assertRaises(ValueError):
                    self.call("create_duel", repo, "v2", "CSV export is available", acceptance,
                              self.now + 3600, amount)
                self.assertEqual(self.contract.get_credit(self.alice), str(self.stake))
        self.call("withdraw")
        self.assertEqual(TRANSFERS, [(self.alice, self.stake)])

    def test_failed_accept_keeps_deposit_and_does_not_reserve_again(self):
        duel_id = self.create()
        self.fund(self.bob, self.stake - 1)
        with self.assertRaisesRegex(ValueError, "Deposit enough"):
            self.call("accept_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.bob), str(self.stake - 1))
        self.assertEqual(self.contract.get_duel(duel_id)["status"], "OPEN")
        self.assertEqual(self.contract.locked, self.stake)

    def test_create_and_accept_reserve_credit_exactly_once(self):
        duel_id = self.match()
        self.assertEqual(self.contract.owed, 0)
        self.assertEqual(self.contract.locked, 2 * self.stake)
        with self.assertRaises(ValueError):
            self.call("accept_duel", duel_id)
        self.assertEqual(self.contract.locked, 2 * self.stake)

    def test_yes_no_and_withdraw_cannot_spend_another_senders_credit(self):
        for verdict, winner in [("YES", self.alice), ("NO", self.bob)]:
            with self.subTest(verdict=verdict):
                self.setUp()
                duel_id = self.match()
                self.now += 3600
                gl.nondet.exec_prompt = lambda _: verdict
                self.call("resolve_duel", duel_id)
                self.as_user(self.outsider, origin=winner)
                with self.assertRaisesRegex(ValueError, "No funds"):
                    self.call("withdraw")
                self.as_user(winner, origin=self.outsider)
                self.call("withdraw")
                self.assertEqual(TRANSFERS, [(winner, 2 * self.stake)])
                self.assertEqual(self.contract.locked + self.contract.owed, 0)

    def test_unknown_refund_preserves_both_deposits(self):
        duel_id = self.match()
        self.now += 3600
        gl.nondet.exec_prompt = lambda _: "UNKNOWN"
        self.call("resolve_duel", duel_id)
        self.assertEqual(self.contract.locked, 2 * self.stake)
        self.now += 3 * 86400 - 1
        with self.assertRaises(ValueError):
            self.call("refund_duel", duel_id)
        self.now += 1
        self.call("refund_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.alice), str(self.stake))
        self.assertEqual(self.contract.get_credit(self.bob), str(self.stake))

    def test_cancel_returns_reserved_and_unspent_credit(self):
        duel_id = self.create()
        self.fund(self.alice, 123)
        self.call("cancel_duel", duel_id)
        self.assertEqual(self.contract.get_credit(self.alice), str(self.stake + 123))
        self.call("withdraw")
        self.assertEqual(TRANSFERS, [(self.alice, self.stake + 123)])

    def test_malformed_wei_and_missing_credit_cannot_create(self):
        for amount in ["1e18", "-1", "9" * 22, str(self.stake)]:
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                self.call("create_duel", "test/repo", "v2", "CSV export is available",
                          self.now + 600, self.now + 3600, amount)
        self.assertEqual(self.contract.count, 0)
