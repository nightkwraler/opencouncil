def test_submit_proposal(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/opencouncil.py")
    direct_vm.sender = direct_alice

    proposal_id = contract.submit_proposal(
        "Build a community library",
        "Create a public library for local residents.",
        "Education and access to knowledge benefit everyone.",
    )

    proposal = contract.get_proposal(proposal_id)

    assert proposal.title == "Build a community library"
    assert proposal.description == "Create a public library for local residents."
    assert proposal.rationale == "Education and access to knowledge benefit everyone."
    assert proposal.eligibility == "pending"
    assert proposal.status == "submitted"
    assert proposal.yes_votes == 0
    assert proposal.no_votes == 0

    council = contract.get_council()
    assert proposal.rules_version == council["rules_version"]
    assert proposal.rules_snapshot == council["rules"]
    assert proposal.quorum_snapshot == council["quorum"]
    assert proposal.approval_threshold_snapshot == council["approval_threshold"]
    assert proposal.voting_duration_snapshot == council["voting_duration"]

    # Updating council policy must not rewrite an existing proposal's snapshot.
    contract.update_rules("Updated council rules")
    contract.update_council_settings(7, 75, 7200)
    updated_proposal = contract.get_proposal(proposal_id)

    assert updated_proposal.rules_snapshot == proposal.rules_snapshot
    assert updated_proposal.rules_version == proposal.rules_version
    assert updated_proposal.quorum_snapshot == proposal.quorum_snapshot
    assert updated_proposal.approval_threshold_snapshot == proposal.approval_threshold_snapshot
    assert updated_proposal.voting_duration_snapshot == proposal.voting_duration_snapshot
