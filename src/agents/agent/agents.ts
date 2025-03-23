import { IPFSService } from '../../services/storage/ipfsService';
import { FarcasterService, FarcasterCredentials } from '../../services/social/farcasterService';
import { ContractInteractionService } from '../../services/contracts/interact';
import { BlockchainProviderService } from '../../services/providers/blockchainProviders';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai"; 
import { StateGraph, END } from "@langchain/langgraph";
import { config } from '../../config/config';
import { IPFSTool, ContractTool, FarcasterTool } from '../tools/tools';
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StructuredTool, Tool } from "@langchain/core/tools";

interface SupervisorOutput {
    agent: string | null;
    response: string | null;
  }

interface AgentStateType {
    input: string;
    agent: string | null;
    response: string | null;
  }

// Initialize Services and Agents
export const initializeAgents = async () => {
  // Initialize services
  const ipfsService = new IPFSService();
  const providerService = new BlockchainProviderService(['ETHEREUM']);
  
  const contractService = new ContractInteractionService({
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    providerUrl: config.provider.rpcUrl,
    etherscanApiKey: config.etherscan.apiKey,
    etherscanNetwork: 'mainnet'
  });
  await contractService.initialize();

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
  const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0, apiKey: process.env.OPENAI_API_KEY});

  // Create agent creation function
  const createAgent = (tools: StructuredTool[], systemMessage: string) => {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `${systemMessage}\nWhen using tools, format your response as a JSON object with a "tool" key specifying the tool name and an "input" key with the tool input.`],
      ["human", "{input}"],
    ]);

    return RunnableSequence.from([
        RunnablePassthrough.assign({
          input: (state: { input: string }) => state.input
        }),
        prompt,
        llm.bindTools(tools),
        {
          process: async (output) => {
            console.log("Agent output:", output);
            if (output.tool_calls && output.tool_calls.length > 0) {
              const toolCall = output.tool_calls[0];
              const tool = tools.find(t => t.name === toolCall.name);
              if (tool) {
                const result = await tool.invoke(toolCall.args);
                console.log("Tool result:", result);
                return result;
              }
            }
            return output.content as string;
          }
        }
      ]);
  };

  const ipfsAgent = createAgent(
    [ipfsTool],
    "You are an IPFS specialist agent. Handle storage-related queries."
  );

  const contractAgent = createAgent(
    [contractTool],
    "You are a blockchain contract specialist agent."
  );

  const farcasterAgent = createAgent(
    [farcasterTool],
    "You are a Farcaster social media specialist agent."
  );

  // Supervisor Agent Logic
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a supervisor agent that routes queries to specialized agents.
        Available agents: 
        - ipfs_agent: for IPFS storage operations
        - contract_agent: for blockchain contract interactions
        - farcaster_agent: for Farcaster social media posts
        
        Analyze the input query and return a JSON object with:
        {{
          "agent": "ipfs_agent" | "contract_agent" | "farcaster_agent" | null,
          "response": string | null
        }}
        If no specialized agent is needed, set "agent" to null and provide a direct response.
        If an agent is needed, set "response" to null.`],
    ["human", "{input}"],
  ]);

  const supervisorAgent = RunnableSequence.from([
    supervisorPrompt,
    llm,
    {
        parse: (output) => {
            try {
                const content = output.content as string;
                console.log("Supervisor output:", content);
                const parsed = JSON.parse(content) as SupervisorOutput;
                return parsed;
                } catch (error: any) {
                console.error("Supervisor parse error:", error);
                return {
                    agent: null,
                    response: `Error parsing supervisor response: ${error.message}`
                } as SupervisorOutput;
            }
        }
    },
  ]);

  // Create State Graph
  const workflow = new StateGraph<AgentStateType>({
    channels: {
      input: null,
      agent: null,
      response: null,
    },
  })
    .addNode("supervisor", async (state) => {
    const result = await supervisorAgent.invoke({ input: state.input });
    console.log("Supervisor result:", result);
    return { agent: result.parse.agent, response: result.parse.response };
    })
    .addNode("ipfs_agent", async (state) => {
    const result = await ipfsAgent.invoke({input: state.input});
    console.log("IPFS Agent result:", result);
    return { response: result };
    })
    .addNode("contract_agent", async (state) => {
    const result = await contractAgent.invoke({input: state.input});
    return { response: result};
    })
    .addNode("farcaster_agent", async (state) => {
    const result = await farcasterAgent.invoke({input: state.input});
    return { response: result};
    })
    .addConditionalEdges("supervisor", (state) => {
        if (state.response) return END;
        return state.agent || END;
      })
    .addEdge("ipfs_agent", END)
    .addEdge("contract_agent", END)
    .addEdge("farcaster_agent", END)
    .setEntryPoint("supervisor");

  return workflow.compile();
};
