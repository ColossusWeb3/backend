import { IPFSService } from '../../services/storage/ipfsService';
import { FarcasterService, FarcasterCredentials } from '../../services/social/farcasterService';
import { ContractInteractionService } from '../../services/contracts/interact';
import { BlockchainProviderService } from '../../services/providers/blockchainProviders';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor } from "@langchain/core/agents";
import { createReactAgent } from "@langchain/core/agents";
import { ChatOpenAI } from "@langchain/openai"; 
import { StateGraph, END } from "@langchain/langgraph";
import { config } from '../../config/config';
import { IPFSTool, ContractTool, FarcasterTool } from '../tools/tools';

// Initialize Services and Agents
const initializeAgents = async () => {
  // Initialize services
  const ipfsService = new IPFSService();
  const providerService = new BlockchainProviderService(['ETHEREUM']);
  
  const contractService = new ContractInteractionService({
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    providerUrl: config.provider.rpcUrl,
    etherscanApiKey: config.etherscan.apiKey,
    etherscanNetwork: 'mainnet'
  });

  const farcasterCredentials: FarcasterCredentials = {
    apiKey: config.farcaster.neynarApiKey,
    signerUuid: config.farcaster.signerUuid,
    fid: config.farcaster.fid
  };
  const farcasterService = new FarcasterService(farcasterCredentials);

  // Create tools
  const ipfsTool = new IPFSTool(ipfsService);
  const contractTool = new ContractTool(contractService);
  const farcasterTool = new FarcasterTool(farcasterService);

  // Create specialized agents
  const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });

  const ipfsAgent = createReactAgent({
    llm,
    tools: [ipfsTool],
    prompt: ChatPromptTemplate.fromMessages([
      ["system", "You are an IPFS specialist agent. Handle storage-related queries."],
      ["human", "{input}"],
    ]),
  });

  const contractAgent = createReactAgent({
    llm,
    tools: [contractTool],
    prompt: ChatPromptTemplate.fromMessages([
      ["system", "You are a blockchain contract specialist agent."],
      ["human", "{input}"],
    ]),
  });

  const farcasterAgent = createReactAgent({
    llm,
    tools: [farcasterTool],
    prompt: ChatPromptTemplate.fromMessages([
      ["system", "You are a Farcaster social media specialist agent."],
      ["human", "{input}"],
    ]),
  });

  // Supervisor Agent Logic
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a supervisor agent that routes queries to specialized agents.
    Available agents: ipfs_agent, contract_agent, farcaster_agent
    Based on the input, choose the appropriate agent or respond directly if no agent is needed.
    Return your response in JSON format:
    {
      "agent": "agent_name" | null,
      "response": "direct response if no agent needed"
    }`],
    ["human", "{input}"],
  ]);

  const supervisorAgent = createReactAgent({
    llm,
    tools: [],
    prompt: supervisorPrompt,
  });

  // Create State Graph
  const workflow = new StateGraph({
    channels: {
      input: null,
      agent: null,
      response: null,
    },
  })
    .addNode("supervisor", async (state) => {
      const executor = AgentExecutor.fromAgentAndTools({
        agent: supervisorAgent,
        tools: [],
      });
      const result = await executor.invoke({ input: state.input });
      const parsed = JSON.parse(result);
      return { agent: parsed.agent, response: parsed.response };
    })
    .addNode("ipfs_agent", async (state) => {
      const executor = AgentExecutor.fromAgentAndTools({
        agent: ipfsAgent,
        tools: [ipfsTool],
      });
      const result = await executor.invoke({ input: state.input });
      return { response: result };
    })
    .addNode("contract_agent", async (state) => {
      const executor = AgentExecutor.fromAgentAndTools({
        agent: contractAgent,
        tools: [contractTool],
      });
      const result = await executor.invoke({ input: state.input });
      return { response: result };
    })
    .addNode("farcaster_agent", async (state) => {
      const executor = AgentExecutor.fromAgentAndTools({
        agent: farcasterAgent,
        tools: [farcasterTool],
      });
      const result = await executor.invoke({ input: state.input });
      return { response: result };
    })
    .addEdge("supervisor", (state) => state.agent || END)
    .addEdge("ipfs_agent", END)
    .addEdge("contract_agent", END)
    .addEdge("farcaster_agent", END)
    .setEntryPoint("supervisor");

  return workflow.compile();
};
