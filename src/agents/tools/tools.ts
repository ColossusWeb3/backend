// agents.ts
import { Tool, StructuredTool } from "@langchain/core/tools";
import { IPFSService } from '../../services/storage/ipfsService';
import { FarcasterService, FarcasterCredentials } from '../../services/social/farcasterService';
import { ContractInteractionService } from '../../services/contracts/interact';
import { BlockchainProviderService } from '../../services/providers/blockchainProviders';
import { config } from '../../config/config';
import { ethers } from 'ethers';
import { z } from "zod";
import { UploadFile } from "../../types";

const ipfsToolSchema = z.object({
    action: z.enum(["upload", "fetch"]),
    data: z.string().describe("content to upload or CID to fetch"),
  });
// Custom Tools
export class IPFSTool extends StructuredTool {
  private ipfsService: IPFSService;
  name = "ipfs_tool";
  description = "Tool for interacting with IPFS - can upload content and fetch content.";
  schema = ipfsToolSchema;
  
  constructor(ipfsService: IPFSService) {
    super();
    this.ipfsService = ipfsService;
  }

  async _call(input: z.infer<typeof ipfsToolSchema>): Promise<string> {
    console.log("IPFS Tool input:", JSON.stringify(input, null, 2));
    try {
      if (input.action === "upload") {
        let jsonData : UploadFile = {name: "temp", content: input.data, timestamp: new Date()};
        const cid = await this.ipfsService.uploadJSON(jsonData);
        console.log("IPFS Upload result:", cid);
        return `Content uploaded to IPFS with CID: ${cid}`;
      } else if (input.action === "fetch") {
        const content = await this.ipfsService.fetchData(input.data as string);
        console.log("IPFS Fetch result:", content);
        return JSON.stringify(content);
      }
      return "Invalid IPFS action";
    } catch (error: any) {
      console.error("IPFS Tool error:", error);
      return `Error in IPFS operation: ${error.message}`;
    }
  }
}

const contractToolSchema = z.object({
    method: z.string().describe("Contract method to call"),
    params: z.array(z.any()).optional().describe("Parameters for the method"),
  });

export class ContractTool extends StructuredTool {
  private contractService: ContractInteractionService;
  name = "contract_tool";
  description = "Tool for interacting with blockchain smart contracts";
  schema = contractToolSchema;

  constructor(contractService: ContractInteractionService) {
    super();
    this.contractService = contractService;
  }

  async _call(input: z.infer<typeof contractToolSchema>): Promise<string> {
    try {
      const result = await this.contractService.call(input.method, ...(input.params || []));
      return ethers.formatEther(result);
    } catch (error: any) {
      return `Error in contract operation: ${error.message}`;
    }
  }
}

const farcasterToolSchema = z.object({
    text: z.string().describe("Text to post as a cast"),
  });

export class FarcasterTool extends StructuredTool {
  private farcasterService: FarcasterService;
  name = "farcaster_tool";
  description = "Tool for posting casts to Farcaster";
  schema = farcasterToolSchema;

  constructor(farcasterService: FarcasterService) {
    super();
    this.farcasterService = farcasterService;
  }

  async _call(input: z.infer<typeof farcasterToolSchema>): Promise<string> {
    try {
      const result = await this.farcasterService.postCast({ text: input.text });
      return JSON.stringify(result);
    } catch (error: any) {
      return `Error in Farcaster operation: ${error.message}`;
    }
  }
}