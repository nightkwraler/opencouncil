# {
#   "Seq": [
#     { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#   ]
# }

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

@allow_storage
@dataclass
class Proposal:
    id: str
    proposer: str
    title: str
    description: str
    rationale: str
    proposal_hash: str
    rules_version: u256
    rules_snapshot: str
    quorum_snapshot: u256
    approval_threshold_snapshot: u256
    voting_duration_snapshot: u256
    eligibility: str
    assessment_json: str
    status: str
    yes_votes: u256
    no_votes: u256
    created_at: u256
    voting_deadline: u256
    finalized_at: u256

class OpenCouncil(gl.Contract):
    admin: Address
    rules: str
    rules_version: u256
    quorum: u256
    approval_threshold: u256
    voting_duration: u256
    next_proposal_id: u256
    proposals: TreeMap[str, Proposal]
    votes: TreeMap[str, str]

    def __init__(
        self,
        initial_rules: str,
        initial_quorum: int,
        initial_approval_threshold: int,
        initial_voting_duration: int,
    ):
        if not initial_rules.strip():
            raise gl.vm.UserError("Governance rules cannot be empty")
        if initial_quorum < 1:
            raise gl.vm.UserError("Quorum must be at least 1")
        if initial_approval_threshold < 1 or initial_approval_threshold > 100:
            raise gl.vm.UserError("Approval threshold must be between 1 and 100")
        if initial_voting_duration < 1:
            raise gl.vm.UserError("Voting duration must be positive")

        self.admin = gl.message.sender_address
        self.rules = initial_rules
        self.rules_version = u256(1)
        self.quorum = u256(initial_quorum)
        self.approval_threshold = u256(initial_approval_threshold)
        self.voting_duration = u256(initial_voting_duration)
        self.next_proposal_id = u256(1)
        

    def _now(self) -> u256:
        return u256(int(datetime.now(timezone.utc).timestamp()))

    def _proposal_key(self, proposal_id: str, voter: str) -> str:
        return proposal_id + ":" + voter.lower()

    @gl.public.write
    def update_rules(self, new_rules: str) -> None:
        if gl.message.sender_address != self.admin:
            raise gl.vm.UserError("Only the council admin can update rules")
        if not new_rules.strip():
            raise gl.vm.UserError("Governance rules cannot be empty")

        self.rules = new_rules
        self.rules_version = u256(int(self.rules_version) + 1)

    @gl.public.write
    def update_council_settings(
        self,
        new_quorum: int,
        new_approval_threshold: int,
        new_voting_duration: int,
    ) -> None:
        if gl.message.sender_address != self.admin:
            raise gl.vm.UserError("Only the council admin can update settings")
        if new_quorum < 1:
            raise gl.vm.UserError("Quorum must be at least 1")
        if new_approval_threshold < 1 or new_approval_threshold > 100:
            raise gl.vm.UserError("Approval threshold must be between 1 and 100")
        if new_voting_duration < 1:
            raise gl.vm.UserError("Voting duration must be positive")

        self.quorum = u256(new_quorum)
        self.approval_threshold = u256(new_approval_threshold)
        self.voting_duration = u256(new_voting_duration)

    @gl.public.write
    def submit_proposal(
        self,
        title: str,
        description: str,
        rationale: str,
    ) -> str:
        if not title.strip():
            raise gl.vm.UserError("Proposal title cannot be empty")
        if not description.strip():
            raise gl.vm.UserError("Proposal description cannot be empty")
        if not rationale.strip():
            raise gl.vm.UserError("Proposal rationale cannot be empty")

        proposal_id = str(int(self.next_proposal_id))
        self.next_proposal_id = u256(int(self.next_proposal_id) + 1)

        proposal_content = json.dumps(
            {
                "title": title,
                "description": description,
                "rationale": rationale,
            },
            sort_keys=True,
        )
        proposal_hash = hashlib.sha256(
            proposal_content.encode("utf-8")
        ).hexdigest()

        proposal = Proposal(
            id=proposal_id,
            proposer=gl.message.sender_address.as_hex,
            title=title,
            description=description,
            rationale=rationale,
            proposal_hash=proposal_hash,
            rules_version=self.rules_version,
            rules_snapshot=self.rules,
            quorum_snapshot=self.quorum,
            approval_threshold_snapshot=self.approval_threshold,
            voting_duration_snapshot=self.voting_duration,
            eligibility="pending",
            assessment_json="",
            status="submitted",
            yes_votes=u256(0),
            no_votes=u256(0),
            created_at=self._now(),
            voting_deadline=u256(0),
            finalized_at=u256(0),
        )

        self.proposals[proposal_id] = proposal
        return proposal_id

    @gl.public.write
    def assess_proposal(self, proposal_id: str) -> dict:
        if proposal_id not in self.proposals:
            raise gl.vm.UserError("Proposal not found")

        proposal = self.proposals[proposal_id]
        if proposal.status != "submitted":
            raise gl.vm.UserError("Proposal has already been assessed")

        # Use the governance conditions captured at proposal submission.
        rules_text = proposal.rules_snapshot
        rules_version = int(proposal.rules_version)
        title = proposal.title
        description = proposal.description
        rationale = proposal.rationale
        proposal_hash = proposal.proposal_hash

        def assess() -> dict:
            prompt = f"""
You are an impartial governance-rule assessor.

Assess this proposal against the council's exact governance rules.
Do not invent rules. Do not decide whether the proposal is popular,
politically desirable, or likely to pass a vote.

COUNCIL RULES (version {rules_version}):
{rules_text}

PROPOSAL:
Title: {title}
Description: {description}
Rationale: {rationale}
Proposal SHA-256: {proposal_hash}

Return a JSON object with exactly these fields:
{{
  "eligibility": "eligible, ineligible, or needs_clarification",
  "reasons": "A concise explanation referencing the applicable rules",
  "missing_information": "Missing information, or an empty string"
}}

Use "eligible" only when the proposal satisfies the stated rules.
Use "ineligible" when it clearly violates a rule.
Use "needs_clarification" when the information is insufficient.
Do not create requirements that are absent from the rules.
"""
            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json",
            )

            if not isinstance(result, dict):
                raise gl.vm.UserError("Assessment response must be a JSON object")

            eligibility = result.get("eligibility")
            reasons = result.get("reasons")
            missing = result.get("missing_information")

            if eligibility not in (
                "eligible",
                "ineligible",
                "needs_clarification",
            ):
                raise gl.vm.UserError("Invalid eligibility value")
            if not isinstance(reasons, str) or not reasons.strip():
                raise gl.vm.UserError("Assessment reasons are required")
            if not isinstance(missing, str):
                raise gl.vm.UserError("Missing-information field must be text")

            return {
                "eligibility": eligibility,
                "reasons": reasons,
                "missing_information": missing,
            }

        def validate(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            leader_data = leader_result.calldata
            if not isinstance(leader_data, dict):
                return False

            try:
                validator_data = assess()
            except Exception:
                return False

            allowed = (
                "eligible",
                "ineligible",
                "needs_clarification",
            )

            return (
                leader_data.get("eligibility") in allowed
                and validator_data.get("eligibility") in allowed
                and leader_data.get("eligibility")
                == validator_data.get("eligibility")
                and isinstance(leader_data.get("reasons"), str)
                and len(leader_data.get("reasons", "").strip()) > 0
                and isinstance(leader_data.get("missing_information"), str)
            )

        result = gl.vm.run_nondet_unsafe(assess, validate)

        proposal.eligibility = result["eligibility"]
        proposal.assessment_json = json.dumps(result, sort_keys=True)
        if result["eligibility"] == "eligible":
            proposal.status = "open"
            proposal.voting_deadline = u256(
                int(self._now()) + int(proposal.voting_duration_snapshot)
            )
        elif result["eligibility"] == "ineligible":
            proposal.status = "ineligible"
        else:
            proposal.status = "needs_clarification"

        self.proposals[proposal_id] = proposal
        return result

    @gl.public.write
    def vote(self, proposal_id: str, choice: str) -> None:
        if proposal_id not in self.proposals:
            raise gl.vm.UserError("Proposal not found")
        if choice not in ("yes", "no"):
            raise gl.vm.UserError("Vote must be yes or no")

        proposal = self.proposals[proposal_id]

        if proposal.status != "open":
            raise gl.vm.UserError("Proposal is not open for voting")
        if int(self._now()) >= int(proposal.voting_deadline):
            raise gl.vm.UserError("Voting period has ended")

        voter = gl.message.sender_address.as_hex
        vote_key = self._proposal_key(proposal_id, voter)

        if vote_key in self.votes:
            raise gl.vm.UserError("You have already voted on this proposal")

        self.votes[vote_key] = choice

        if choice == "yes":
            proposal.yes_votes = u256(int(proposal.yes_votes) + 1)
        else:
            proposal.no_votes = u256(int(proposal.no_votes) + 1)

        self.proposals[proposal_id] = proposal

    @gl.public.write
    def finalize_proposal(self, proposal_id: str) -> str:
        if proposal_id not in self.proposals:
            raise gl.vm.UserError("Proposal not found")

        proposal = self.proposals[proposal_id]

        if proposal.status != "open":
            raise gl.vm.UserError("Proposal is not awaiting finalization")
        if int(self._now()) < int(proposal.voting_deadline):
            raise gl.vm.UserError("Voting period has not ended")

        total_votes = int(proposal.yes_votes) + int(proposal.no_votes)

        if total_votes < int(proposal.quorum_snapshot):
            proposal.status = "failed_quorum"
        else:
            approval = (
                int(proposal.yes_votes) * 100
                >= total_votes * int(proposal.approval_threshold_snapshot)
            )
            proposal.status = "passed" if approval else "rejected"

        proposal.finalized_at = self._now()
        self.proposals[proposal_id] = proposal
        return proposal.status

    @gl.public.view
    def get_council(self) -> dict:
        return {
            "admin": self.admin.as_hex,
            "rules": self.rules,
            "rules_version": int(self.rules_version),
            "quorum": int(self.quorum),
            "approval_threshold": int(self.approval_threshold),
            "voting_duration": int(self.voting_duration),
        }

    @gl.public.view
    def get_proposal(self, proposal_id: str) -> Proposal:
        if proposal_id not in self.proposals:
            raise gl.vm.UserError("Proposal not found")
        return self.proposals[proposal_id]

    @gl.public.view
    def get_proposals(self) -> dict:
        return {key: value for key, value in self.proposals.items()}

    @gl.public.view
    def get_vote(self, proposal_id: str, voter_address: str) -> str:
        vote_key = self._proposal_key(proposal_id, voter_address)
        return self.votes.get(vote_key, "")

