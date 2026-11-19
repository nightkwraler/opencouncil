
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ShieldCheck,
  Vote,
  FileText,
  Settings,
  Plus,
  Clock,
  CheckCircle2,
  Scale,
  Users,
  ArrowRight,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import OpenCouncil from "@/lib/contracts/OpenCouncil";

type CouncilData = {
  rules?: string;
  rules_version?: number;
  quorum?: number;
  approval_threshold?: number;
  voting_duration?: number;
};

type AssessmentDetails = {
  eligibility?: string;
  reasons?: string;
  missing_information?: string;
};

function normalizeProposals(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.proposals)) return raw.proposals;

  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([id, value]: [string, any]) => ({
      ...(value && typeof value === "object" ? value : {}),
      id: value?.id ?? value?.proposal_id ?? value?.proposalId ?? id,
    }));
  }

  return [];
}

function getProposalId(proposal: any): string | null {
  const id = proposal?.id ?? proposal?.proposal_id ?? proposal?.proposalId;
  return id === undefined || id === null ? null : String(id);
}

function getAssessmentDetails(proposal: any): AssessmentDetails | null {
  const raw =
    proposal?.assessment_json ??
    proposal?.assessmentJson ??
    proposal?.assessment;

  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!parsed || typeof parsed !== "object") return null;

    return {
      eligibility: parsed.eligibility,
      reasons: parsed.reasons,
      missing_information: parsed.missing_information,
    };
  } catch {
    return null;
  }
}

function formatStatus(value: string): string {
  return value.replace(/_/g, " ");
}

export default function HomePage() {
  const wallet = useWallet();
  const address = wallet.address ?? undefined;

  const [activeTab, setActiveTab] = useState("Overview");
  const [council, setCouncil] = useState<CouncilData | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const [assessingId, setAssessingId] = useState<string | null>(null);
  const [assessmentMessage, setAssessmentMessage] = useState("");
  const [assessmentError, setAssessmentError] = useState("");

  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState("");
  const [voteError, setVoteError] = useState("");

  const tabs = ["Overview", "Proposals", "Governance Rules", "History"];

  async function refreshContractData() {
    try {
      setLoading(true);
      setError("");

      const contract = new OpenCouncil(address);
      const [councilResult, proposalsResult] = await Promise.all([
        contract.getCouncil(),
        contract.getProposals(),
      ]);

      setCouncil(councilResult);
      setProposals(normalizeProposals(proposalsResult));
    } catch (err: any) {
      setError(
        err?.message || "Unable to load data from the OpenCouncil contract."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const contract = new OpenCouncil(address);
        const [councilResult, proposalsResult] = await Promise.all([
          contract.getCouncil(),
          contract.getProposals(),
        ]);

        if (!cancelled) {
          setCouncil(councilResult);
          setProposals(normalizeProposals(proposalsResult));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message || "Unable to load data from the OpenCouncil contract."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [address]);

  async function handleSubmitProposal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!wallet.isConnected || !address) {
      setSubmitError("Connect your wallet before submitting.");
      return;
    }

    if (!wallet.isOnCorrectNetwork) {
      setSubmitError("Please switch your wallet to GenLayer Studio.");
      return;
    }

    if (!title.trim() || !description.trim() || !rationale.trim()) {
      setSubmitError("Please complete all three fields.");
      return;
    }

    try {
      setSubmitting(true);

      const contract = new OpenCouncil(address);

      await contract.submitProposal(
        title.trim(),
        description.trim(),
        rationale.trim()
      );

      setTitle("");
      setDescription("");
      setRationale("");
      setSubmitSuccess("Proposal submitted successfully.");

      await refreshContractData();
    } catch (err: any) {
      setSubmitError(err?.message || "Proposal submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssessProposal(proposal: any) {
    const proposalId = getProposalId(proposal);

    setAssessmentError("");
    setAssessmentMessage("");

    if (!proposalId) {
      setAssessmentError(
        "This proposal has no readable ID. Assessment cannot proceed."
      );
      return;
    }

    if (!wallet.isConnected || !address) {
      setAssessmentError("Connect your wallet before assessing.");
      return;
    }

    if (!wallet.isOnCorrectNetwork) {
      setAssessmentError("Switch your wallet to GenLayer Studio.");
      return;
    }

    try {
      setAssessingId(proposalId);
      setAssessmentMessage("Submitting assessment to GenLayer. Please wait...");

      const contract = new OpenCouncil(address);
      await contract.assessProposal(proposalId);

      await refreshContractData();

      setAssessmentMessage(
        "Assessment transaction completed. The updated result is shown below."
      );
    } catch (err: any) {
      setAssessmentMessage("");
      setAssessmentError(err?.message || "Proposal assessment failed.");
    } finally {
      setAssessingId(null);
    }
  }

  async function handleVote(proposal: any, choice: "yes" | "no") {
    const proposalId = getProposalId(proposal);

    setVoteError("");
    setVoteMessage("");

    if (!proposalId) {
      setVoteError("This proposal has no readable ID. Voting cannot proceed.");
      return;
    }

    if (!wallet.isConnected || !address) {
      setVoteError("Connect your wallet before voting.");
      return;
    }

    if (!wallet.isOnCorrectNetwork) {
      setVoteError("Switch your wallet to GenLayer Studio before voting.");
      return;
    }

    if (String(proposal.status || "").toLowerCase() !== "open") {
      setVoteError("This proposal is not currently open for voting.");
      return;
    }

    try {
      setVotingId(proposalId);
      setVoteMessage(
        `Submitting your ${choice === "yes" ? "Approve" : "Reject"} vote to GenLayer. Please wait...`
      );

      const contract = new OpenCouncil(address);

      await contract.vote(proposalId, choice);

      setVoteMessage("Vote transaction completed successfully.");

      await refreshContractData();
    } catch (err: any) {
      setVoteMessage("");
      setVoteError(
        err?.message ||
          "Voting failed. You may have already voted on this proposal."
      );
    } finally {
      setVotingId(null);
    }
  }

  const eligibleCount = proposals.filter(
    (proposal) =>
      String(proposal.eligibility || "").toLowerCase() === "eligible"
  ).length;

  const activeVotes = proposals.filter(
    (proposal) => String(proposal.status || "").toLowerCase() === "open"
  ).length;

  const finalizedProposals = proposals.filter((proposal) =>
    ["passed", "rejected", "failed_quorum"].includes(
      String(proposal.status || "").toLowerCase()
    )
  );

  const stats = [
    {
      label: "Total Proposals",
      value: loading ? "..." : String(proposals.length),
      icon: FileText,
    },
    {
      label: "Eligible Proposals",
      value: loading ? "..." : String(eligibleCount),
      icon: CheckCircle2,
    },
    {
      label: "Active Votes",
      value: loading ? "..." : String(activeVotes),
      icon: Vote,
    },
    {
      label: "Rules Version",
      value: loading ? "..." : String(council?.rules_version ?? "—"),
      icon: Scale,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-8">
        <section className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-accent">
              <ShieldCheck size={17} />
              GENLAYER-POWERED GOVERNANCE
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              OpenCouncil
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Transparent community decisions, intelligent proposal assessment,
              and accountable on-chain voting.
            </p>
          </div>

          <button
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-white transition hover:opacity-90"
            onClick={() => setActiveTab("Proposals")}
          >
            <Plus size={18} />
            New Proposal
          </button>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Contract connection error: {error}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="glass-card rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <item.icon className="text-accent" size={20} />
              </div>
              <div className="text-3xl font-bold">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-accent text-white"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </section>

        {activeTab === "Overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-card rounded-xl p-6 lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Recent Proposals</h2>
                <button
                  onClick={() => setActiveTab("Proposals")}
                  className="flex items-center gap-2 text-sm text-accent"
                >
                  View all <ArrowRight size={16} />
                </button>
              </div>

              {loading ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Loading proposals from GenLayer...
                </p>
              ) : proposals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/20 p-10 text-center">
                  <FileText
                    className="mx-auto mb-3 text-muted-foreground"
                    size={32}
                  />
                  <p className="font-medium">No proposals yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Submit the first proposal to get the council started.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals.slice(0, 5).map((proposal, index) => (
                    <div
                      key={getProposalId(proposal) ?? index}
                      className="rounded-lg border border-white/10 p-4"
                    >
                      <h3 className="font-semibold">
                        {proposal.title || "Untitled proposal"}
                      </h3>
                      <p className="mt-1 text-sm capitalize text-muted-foreground">
                        {formatStatus(
                          String(
                            proposal.status ||
                              proposal.eligibility ||
                              "Submitted"
                          )
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="mb-5 text-xl font-bold">Council Status</h2>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Wallet</span>
                  <span className="text-sm font-medium">
                    {wallet.isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <span className="text-sm font-medium">
                    {wallet.isOnCorrectNetwork ? "Studio" : "Not verified"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Rules version
                  </span>
                  <span className="text-sm font-medium">
                    {council?.rules_version ?? "Not loaded"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Quorum</span>
                  <span className="text-sm font-medium">
                    {council?.quorum ?? "Not loaded"}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Users size={16} className="text-accent" />
                  Community governance
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Proposals are assessed against council rules before eligible
                  proposals proceed to community voting.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Proposals" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-xl p-6">
              <h2 className="mb-2 text-xl font-bold">Submit a Proposal</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Present an idea for the council community to consider.
              </p>

              <form onSubmit={handleSubmitProposal} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Proposal title
                  </label>
                  <input
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a clear proposal title"
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-3 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what you want the council to do"
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-3 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Rationale
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Explain why this proposal benefits the community"
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-3 outline-none focus:border-accent"
                  />
                </div>

                {submitError && (
                  <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                    {submitError}
                  </p>
                )}

                {submitSuccess && (
                  <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
                    {submitSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={18} />
                  {submitting ? "Submitting to GenLayer..." : "Submit Proposal"}
                </button>
              </form>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="mb-2 text-xl font-bold">Council Proposals</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Proposals retrieved from your deployed OpenCouncil contract.
              </p>

              {loading ? (
                <p className="text-sm text-muted-foreground">
                  Loading proposals...
                </p>
              ) : proposals.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto mb-3 text-accent" size={36} />
                  <p className="font-medium">No proposals submitted yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal, index) => {
                    const proposalId = getProposalId(proposal);
                    const assessment = getAssessmentDetails(proposal);
                    const status = String(
                      proposal.status || proposal.eligibility || "submitted"
                    ).toLowerCase();

                    return (
                      <div
                        key={proposalId ?? index}
                        className="rounded-lg border border-white/10 p-5"
                      >
                        <h3 className="font-bold">
                          {proposal.title || "Untitled proposal"}
                        </h3>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {proposal.description || "No description available."}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Status:
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                              status === "open"
                                ? "bg-green-500/10 text-green-400"
                                : status === "needs_clarification"
                                  ? "bg-yellow-500/10 text-yellow-400"
                                  : status === "ineligible"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-white/10 text-muted-foreground"
                            }`}
                          >
                            {formatStatus(status)}
                          </span>
                        </div>

                        {assessment && (
                          <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle
                                size={16}
                                className="text-accent"
                              />
                              <h4 className="text-sm font-semibold">
                                GenLayer Assessment
                              </h4>
                            </div>

                            {assessment.eligibility && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Decision
                                </p>
                                <p className="mt-1 text-sm font-semibold capitalize">
                                  {formatStatus(assessment.eligibility)}
                                </p>
                              </div>
                            )}

                            {assessment.reasons && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Assessment reasons
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                  {assessment.reasons}
                                </p>
                              </div>
                            )}

                            {assessment.missing_information && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Missing information
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-yellow-400">
                                  {assessment.missing_information}
                                </p>
                              </div>
                            )}

                            {proposal.rules_version !== undefined && (
                              <p className="border-t border-white/10 pt-3 text-xs text-muted-foreground">
                                Assessed under rules version{" "}
                                {String(proposal.rules_version)}
                              </p>
                            )}
                          </div>
                        )}

                        {proposalId && status === "submitted" && (
                          <button
                            type="button"
                            onClick={() => handleAssessProposal(proposal)}
                            disabled={
                              assessingId !== null ||
                              !wallet.isConnected ||
                              !wallet.isOnCorrectNetwork
                            }
                            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {assessingId === proposalId
                              ? "Assessing on GenLayer..."
                              : "Assess Proposal"}
                          </button>
                        )}

                        {proposalId && status === "open" && (
                          <div className="mt-5 border-t border-white/10 pt-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Vote size={17} className="text-accent" />
                              <h4 className="font-semibold">
                                Community Voting
                              </h4>
                            </div>

                            <p className="mb-4 text-xs leading-5 text-muted-foreground">
                              Cast one vote on this proposal. Your vote is
                              recorded on-chain and cannot be changed.
                            </p>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => handleVote(proposal, "yes")}
                                disabled={
                                  votingId !== null ||
                                  !wallet.isConnected ||
                                  !wallet.isOnCorrectNetwork
                                }
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <ThumbsUp size={16} />
                                {votingId === proposalId
                                  ? "Submitting vote..."
                                  : "Approve"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVote(proposal, "no")}
                                disabled={
                                  votingId !== null ||
                                  !wallet.isConnected ||
                                  !wallet.isOnCorrectNetwork
                                }
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <ThumbsDown size={16} />
                                Reject
                              </button>
                            </div>

                            {!wallet.isConnected && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Connect your wallet to vote.
                              </p>
                            )}

                            {wallet.isConnected &&
                              !wallet.isOnCorrectNetwork && (
                                <p className="mt-3 text-xs text-red-400">
                                  Switch to GenLayer Studio to vote.
                                </p>
                              )}
                          </div>
                        )}

                        {!proposalId && (
                          <p className="mt-4 text-xs text-red-400">
                            Proposal ID unavailable. Cannot assess or vote on
                            this proposal.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {assessmentMessage && (
                <p className="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
                  {assessmentMessage}
                </p>
              )}

              {assessmentError && (
                <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                  {assessmentError}
                </p>
              )}

              {voteMessage && (
                <p className="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
                  {voteMessage}
                </p>
              )}

              {voteError && (
                <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                  {voteError}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "Governance Rules" && (
          <div className="glass-card rounded-xl p-8">
            <div className="mb-5 flex items-center gap-2">
              <Settings className="text-accent" size={20} />
              <h2 className="text-xl font-bold">Governance Rules</h2>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading council rules...
              </p>
            ) : council ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-semibold">Council rules</p>
                  <p className="rounded-lg bg-white/5 p-4 text-sm leading-7 text-muted-foreground">
                    {council.rules || "No rules available."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      Rules version
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {council.rules_version ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white/5 p-4">
                    <p className="text-sm text-muted-foreground">Quorum</p>
                    <p className="mt-2 text-2xl font-bold">
                      {council.quorum ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      Approval threshold
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {council.approval_threshold ?? "—"}%
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    Voting duration
                  </p>
                  <p className="mt-2 font-semibold">
                    {council.voting_duration != null
                      ? `${council.voting_duration / 3600} hours`
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Council settings could not be loaded.
              </p>
            )}
          </div>
        )}

        {activeTab === "History" && (
          <div className="glass-card rounded-xl p-8">
            <div className="mb-5 flex items-center gap-2">
              <Clock className="text-accent" size={20} />
              <h2 className="text-xl font-bold">Decision History</h2>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading decision history...
              </p>
            ) : finalizedProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No finalized council decisions yet.
              </p>
            ) : (
              <div className="space-y-3">
                {finalizedProposals.map((proposal, index) => (
                  <div
                    key={getProposalId(proposal) ?? index}
                    className="rounded-lg border border-white/10 p-4"
                  >
                    <h3 className="font-semibold">
                      {proposal.title || "Untitled proposal"}
                    </h3>
                    <p className="mt-2 text-sm capitalize text-muted-foreground">
                      {formatStatus(String(proposal.status))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Submit a proposal",
              description:
                "Community members submit ideas with clear rationale.",
            },
            {
              number: "02",
              title: "Intelligent assessment",
              description:
                "GenLayer evaluates proposals against council rules.",
            },
            {
              number: "03",
              title: "Community voting",
              description:
                "Eligible proposals proceed to transparent on-chain voting.",
            },
          ].map((step) => (
            <div key={step.number} className="glass-card rounded-xl p-6">
              <span className="text-sm font-bold text-accent">
                {step.number}
              </span>
              <h3 className="mt-3 font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-muted-foreground">
        OpenCouncil · Powered by GenLayer
      </footer>
    </div>
  );
}