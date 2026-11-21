import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/opencouncil.py");

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    await client.initializeConsensusSmartContract();

    const initialRules = process.env.OPENCOUNCIL_INITIAL_RULES;
    const initialQuorum = Number(process.env.OPENCOUNCIL_INITIAL_QUORUM);
    const initialApprovalThreshold = Number(process.env.OPENCOUNCIL_INITIAL_APPROVAL_THRESHOLD);
    const initialVotingDuration = Number(process.env.OPENCOUNCIL_INITIAL_VOTING_DURATION);

    if (!initialRules?.trim()) throw new Error("Set OPENCOUNCIL_INITIAL_RULES before deployment.");
    if (!Number.isInteger(initialQuorum) || initialQuorum < 1) throw new Error("OPENCOUNCIL_INITIAL_QUORUM must be a positive integer.");
    if (!Number.isInteger(initialApprovalThreshold) || initialApprovalThreshold < 1 || initialApprovalThreshold > 100) throw new Error("OPENCOUNCIL_INITIAL_APPROVAL_THRESHOLD must be an integer from 1 to 100.");
    if (!Number.isInteger(initialVotingDuration) || initialVotingDuration < 1) throw new Error("OPENCOUNCIL_INITIAL_VOTING_DURATION must be a positive number of seconds.");

    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: [initialRules, initialQuorum, initialApprovalThreshold, initialVotingDuration],
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
    });

    if (
      receipt.status !== 5 &&
      receipt.status !== 6 &&
      receipt.statusName !== "ACCEPTED" &&
      receipt.statusName !== "FINALIZED"
    ) {
      throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
    }

    const deployedContractAddress =
      (client.chain as GenLayerChain).id === localnet.id
        ? receipt.data.contract_address
        : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

    console.log(`Contract deployed at address: ${deployedContractAddress}`);
  } catch (error) {
    throw new Error(`Error during deployment:, ${error}`);
  }
}
