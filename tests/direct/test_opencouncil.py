def test_submit_proposal(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/opencouncil.py", "Members must follow the published governance rules.", 2, 60, 86400)
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

    assert proposal.rules_version == 1
    assert proposal.rules_snapshot == "Members must follow the published governance rules."
    assert proposal.quorum_snapshot == 2
    assert proposal.approval_threshold_snapshot == 60
    assert proposal.voting_duration_snapshot == 86400

