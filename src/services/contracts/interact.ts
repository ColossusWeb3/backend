import { ethers, EventFilter } from 'ethers';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { ContractConfig } from '../../types';


export class ContractInteractionService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;
  private contract!: ethers.Contract;
  private logger: ReturnType<typeof createLogger>;
  private eventListeners: Map<string, ethers.Listener> = new Map();

  constructor(private config: ContractConfig, logger?: ReturnType<typeof createLogger>) {
    this.logger = createLogger("Contract Interact Service") || console;
    this.provider = new ethers.JsonRpcProvider(config.providerUrl);
  }

  /**
   * Initialize the contract instance
   * This is separated from the constructor to allow for async ABI fetching
   */
  async initialize(): Promise<void> {
    // If ABI is not provided, try to fetch it from Etherscan
    if (!this.config.abi) {
      if (!this.config.etherscanApiKey) {
        throw new Error('Either ABI or Etherscan API key must be provided');
      }
      
      try {
        this.logger.info(`Fetching ABI for contract ${this.config.address} from Etherscan`);
        this.config.abi = await this.getVerifiedContractABI(
          this.config.address, 
          this.config.etherscanApiKey, 
          this.config.etherscanNetwork || 'mainnet'
        );
      } catch (error: any) {
        throw new Error(`Could not get ABI: ${error.message}`);
      }
    }
    
    // Create contract instance
    if (this.config.privateKey) {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      this.contract = new ethers.Contract(this.config.address, this.config.abi, this.wallet);
    } else {
      this.contract = new ethers.Contract(this.config.address, this.config.abi, this.provider);
    }
    
    this.logger.info(`Contract initialized at address ${this.config.address}`);
  }

  /**
   * Fetch verified contract ABI from Etherscan
   * @param address Contract address
   * @param apiKey Etherscan API key
   * @param network Etherscan network
   * @returns Contract ABI
   */
  private async getVerifiedContractABI(
    address: string, 
    apiKey: string, 
    network: string = 'mainnet'
  ): Promise<any[]> {
    // Determine the correct API URL based on the network
    let baseUrl = 'https://api.etherscan.io/api';
    if (network !== 'mainnet') {
      baseUrl = `https://api-${network}.etherscan.io/api`;
    }
    
    // Special case for named networks
    if (network === 'polygon') {
      baseUrl = 'https://api.polygonscan.com/api';
    } else if (network === 'arbitrum') {
      baseUrl = 'https://api.arbiscan.io/api';
    } else if (network === 'optimism') {
      baseUrl = 'https://api-optimistic.etherscan.io/api';
    }
    
    const url = `${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json() as {status: string; result: string; message?: string};
      
      if (data.status === '1' && data.result) {
        this.logger.info(`Successfully fetched ABI from ${network} Etherscan`);
        return JSON.parse(data.result);
      } else {
        throw new Error(`Etherscan API error: ${data.message || data.result}`);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch ABI from Etherscan: ${error}`);
      throw error;
    }
  }

  /**
   * Call a read-only method on the contract
   * @param method The method name to call
   * @param args Arguments to pass to the method
   * @returns The result of the contract call
   */
  async call(method: string, ...args: any[]): Promise<any> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    try {
      this.logger.info(`Calling ${method} with args: ${JSON.stringify(args)}`);
      return await this.contract[method](...args);
    } catch (error) {
      this.logger.error(`Error calling ${method}: ${error}`);
      throw error;
    }
  }

  /**
   * Send a transaction to the contract
   * @param method The method name to call
   * @param args Arguments to pass to the method
   * @param options Transaction options (gas, value, etc.)
   * @returns Transaction receipt
   */
  async sendTransaction(
    method: string, 
    args: any[] = [], 
    options: ethers.Overrides = {}
  ): Promise<ethers.ContractTransactionReceipt> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    if (!this.wallet) {
      throw new Error('Private key not provided. Cannot send transactions.');
    }

    try {
      this.logger.info(`Sending transaction to ${method} with args: ${JSON.stringify(args)}`);
      const tx = await this.contract[method](...args, options);
      this.logger.info(`Transaction sent with hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      this.logger.error(`Error sending transaction to ${method}: ${error}`);
      throw error;
    }
  }

  /**
   * Subscribe to a contract event
   * @param eventName The event name to listen for
   * @param callback Function to call when the event is emitted
   * @param filter Optional filter for the event
   * @returns A unique identifier for the event listener
   */
  subscribeToEvent(
    eventName: string, 
    callback: (eventData: any) => void,
    filter: EventFilter = {}
  ): string {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    try {
      this.logger.info(`Subscribing to event: ${eventName}`);
      
      const listener = (log: ethers.EventLog) => {
        this.logger.info(`Event ${eventName} received in block ${log.blockNumber}`);
        callback({
          eventName,
          data: log.args,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          event: log
        });
      };

      this.contract.on(eventName, listener);
      
      const listenerId = `${eventName}-${Date.now()}`;
      this.eventListeners.set(listenerId, listener);
      
      return listenerId;
    } catch (error) {
      this.logger.error(`Error subscribing to event ${eventName}: ${error}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from a contract event
   * @param listenerId The ID returned when subscribing to the event
   */
  unsubscribeFromEvent(listenerId: string): void {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    const listener = this.eventListeners.get(listenerId);
    if (!listener) {
      this.logger.warn(`Listener ${listenerId} not found`);
      return;
    }

    try {
      this.contract.off(listenerId.split('-')[0], listener);
      this.eventListeners.delete(listenerId);
      this.logger.info(`Unsubscribed from event: ${listenerId}`);
    } catch (error) {
      this.logger.error(`Error unsubscribing from event ${listenerId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get past events from the contract
   * @param eventName The event name to query
   * @param filter Filter options (fromBlock, toBlock, etc.)
   * @returns Array of past events
   */
  async getPastEvents(
    eventName: string, 
    filter: { fromBlock?: number | string; toBlock?: number | string; topics?: string[] } = {}
  ): Promise<any[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    try {
      const { fromBlock = 0, toBlock = 'latest', topics } = filter;
      
      this.logger.info(`Getting past events for ${eventName} from block ${fromBlock} to ${toBlock}`);
      const eventFilter = this.contract.filters[eventName]();
      const filterWithTopics = topics? {...eventFilter, topics: topics as ethers.TopicFilter } : eventFilter;
      const events = await this.contract.queryFilter(
        filterWithTopics,
        fromBlock,
        toBlock
      );
      
      this.logger.info(`Found ${events.length} past events for ${eventName}`);
      return events.map(event => ({
        eventName,
        data: 'args' in event ? event.args : undefined,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        event
      }));
    } catch (error) {
      this.logger.error(`Error getting past events for ${eventName}: ${error}`);
      throw error;
    }
  }

  /**
   * Get the current nonce for the wallet
   * @returns Current nonce
   */
  async getNonce(): Promise<number> {
    if (!this.wallet) {
      throw new Error('Private key not provided. Cannot get nonce.');
    }
    return await this.wallet.getNonce();
  }

  /**
   * Estimate gas for a transaction
   * @param method The method name to call
   * @param args Arguments to pass to the method
   * @returns Estimated gas
   */
  async estimateGas(method: string, ...args: any[]): Promise<bigint> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    try {
        const contractWithMethods = this.contract as ethers.Contract & {
            estimateGas: {[key: string]: (...args: any[]) => Promise<bigint>};
        };
      return await contractWithMethods.estimateGas[method](...args);
    } catch (error) {
      this.logger.error(`Error estimating gas for ${method}: ${error}`);
      throw error;
    }
  }

  /**
   * Create a batch of transactions to be sent together
   * @param transactions Array of transactions to send
   * @returns Array of transaction receipts
   */
  async batchTransactions(
    transactions: Array<{ method: string; args: any[]; options?: ethers.Overrides }>
  ): Promise<ethers.ContractTransactionReceipt[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    if (!this.wallet) {
      throw new Error('Private key not provided. Cannot send transactions.');
    }

    const receipts: ethers.ContractTransactionReceipt[] = [];
    let nonce = await this.getNonce();

    for (const tx of transactions) {
      try {
        const options = { ...tx.options, nonce: nonce++ };
        const receipt = await this.sendTransaction(tx.method, tx.args, options);
        receipts.push(receipt);
      } catch (error) {
        this.logger.error(`Error in batch transaction: ${error}`);
        throw error;
      }
    }

    return receipts;
  }

  /**
   * Get contract interface (ABI functions and events)
   * @returns Object containing information about contract interface
   */
  getContractInterface(): { functions: string[], events: string[] } {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    
    const interface_ = this.contract.interface;
    
    // Get all function names
    const functions = Object.values(interface_.fragments).filter(frag => frag.type === 'function').map(frag => frag.format());
    
    // Get all event names
    const events = Object.values(interface_.fragments).filter(frag => frag.type === 'event').map(frag => frag.format());
    
    return { functions, events };
  }

  /**
   * Close all connections and cleanup
   */
  disconnect(): void {
    // Unsubscribe from all events
    for (const listenerId of this.eventListeners.keys()) {
      this.unsubscribeFromEvent(listenerId);
    }
    
    this.provider.destroy();
    
    this.logger.info('Contract interaction service disconnected');
  }
}