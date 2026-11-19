"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getContractAddress, getStudioUrl } from "../genlayer/client";

export class OpenCouncil {
  private client: any;
  private contractAddress: `0x${string}`;

  constructor(address?: string) {
    const contractAddress = getContractAddress();

    if (!contractAddress) {
      throw new Error("OpenCouncil contract address is not configured.");
    }

    this.contractAddress = contractAddress as `0x${string}`;

    const config: any = { chain: studionet };

    if (address) config.account = address as `0x${string}`;

    const studioUrl = getStudioUrl();
    if (studioUrl) config.endpoint = studioUrl;

    this.client = createClient(config);
  }

  async getCouncil(): Promise<any> {
    return this.client.readContract({
      address: this.contractAddress,
      functionName: "get_council",
      args: [],
    });
  }

  async getProposals(): Promise<any> {
    return this.client.readContract({
      address: this.contractAddress,
      functionName: "get_proposals",
      args: [],
    });
  }

  async getProposal(proposalId: string): Promise<any> {
    return this.client.readContract({
      address: this.contractAddress,
      functionName: "get_proposal",
      args: [proposalId],
    });
  }

  private async write(functionName: string, args: any[]): Promise<any> {
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName,
      args,
      value: BigInt(0),
    });

    return this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 24,
      interval: 5000,
    });
  }

  async submitProposal(
    title: string,
    description: string,
    rationale: string
  ): Promise<any> {
    return this.write("submit_proposal", [title, description, rationale]);
  }

  async assessProposal(proposalId: string): Promise<any> {
    return this.write("assess_proposal", [proposalId]);
  }

  async vote(proposalId: string, choice: string): Promise<any> {
    return this.write("vote", [proposalId, choice]);
  }

  async finalizeProposal(proposalId: string): Promise<any> {
    return this.write("finalize_proposal", [proposalId]);
  }

  async updateRules(rules: string): Promise<any> {
    return this.write("update_rules", [rules]);
  }

  async updateCouncilSettings(
    quorum: number,
    approvalThreshold: number,
    votingDuration: number
  ): Promise<any> {
    return this.write("update_council_settings", [
      quorum,
      approvalThreshold,
      votingDuration,
    ]);
  }
}

export default OpenCouncil;
