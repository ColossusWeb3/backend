// agents.ts
import { Tool } from "@langchain/core/tools";
import { IPFSService } from '../../services/storage/ipfsService';
import { FarcasterService, FarcasterCredentials } from '../../services/social/farcasterService';
import { ContractInteractionService } from '../../services/contracts/interact';
import { BlockchainProviderService } from '../../services/providers/blockchainProviders';
import { config } from '../../config/config';
import { ethers } from 'ethers';

// Custom Tools
export class IPFSTool extends Tool {
  private ipfsService: IPFSService;
  name = "ipfs_tool";
  description = "Tool for interacting with IPFS - can upload JSON data and fetch content";

  constructor(ipfsService: IPFSService) {
    super();
    this.ipfsService = ipfsService;
  }

  async _call(input: string): Promise<string> {
    const { action, data } = JSON.parse(input);
    if (action === "upload") {
      const cid = await this.ipfsService.uploadJSON(data);
      return `Content uploaded to IPFS with CID: ${cid}`;
    } else if (action === "fetch") {
      const content = await this.ipfsService.fetchData(data);
      return JSON.stringify(content);
    }
    return "Invalid IPFS action";
  }
}

export class ContractTool extends Tool {
  private contractService: ContractInteractionService;
  name = "contract_tool";
  description = "Tool for interacting with blockchain smart contracts";

  constructor(contractService: ContractInteractionService) {
    super();
    this.contractService = contractService;
  }

  async _call(input: string): Promise<string> {
    const { method, params } = JSON.parse(input);
    const result = await this.contractService.call(method, ...(params || []));
    return ethers.formatEther(result);
  }
}

export class FarcasterTool extends Tool {
  private farcasterService: FarcasterService;
  name = "farcaster_tool";
  description = "Tool for posting casts to Farcaster";

  constructor(farcasterService: FarcasterService) {
    super();
    this.farcasterService = farcasterService;
  }

  async _call(input: string): Promise<string> {
    const { text } = JSON.parse(input);
    const result = await this.farcasterService.postCast({ text });
    return JSON.stringify(result);
  }
}


// Update index.ts

// async function main() {
//   validateConfig();
  
//   const app = express();
//   app.use(express.json());

//   const agentGraph = await initializeAgents();

//   // API endpoint for agent interactions
//   app.post('/api/agent', async (req, res) => {
//     try {
//       const { query } = req.body;
//       const result = await agentGraph.invoke({ input: query });
//       res.json({ success: true, response: result.response });
//     } catch (error: any) {
//       res.status(500).json({ success: false, error: error.message });
//     }
//   });

//   app.listen(config.server.port, () => {
//     console.log(`Server started on port ${config.server.port}`);
//   });
// }

// main();