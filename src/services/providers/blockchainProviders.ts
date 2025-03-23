import {ethers, Provider, Wallet} from 'ethers';
import { getProvider, NETWORKS } from '../../config';
import {createLogger} from '../../utils/logger'
import { error } from 'console';

const logger = createLogger("Blockchain Provider Service");

export class BlockchainProviderService{
    private providers: Map<string, Provider> = new Map();
    private wallets: Map<string, Wallet> = new Map();

  /**
   * Initialize providers for specified networks
   * @param networks Array of network keys to initialize
   */
  constructor(networks: string[] = ['ETHEREUM']) {
    for (const network of networks) {
      try {
        this.providers.set(network, getProvider(network));
        logger.info(`Initialized provider for ${network}`);
      } catch (error) {
        logger.error(`Failed to initialize provider for ${network}`, error);
        throw error;
      }
    }
  }

  /**
   * Get provider for a specific network
   * @param network Network identifier
   * @returns Provider instance
   */
  getProvider(network: string = 'ETHEREUM'): Provider {
    const provider = this.providers.get(network);
    
    if (!provider) {
      throw new Error(`Provider for ${network} not initialized`);
    }
    
    return provider;
  }
  /**
   * Connect wallet with private key
   * @param privateKey Wallet private key
   * @param network Network to connect to
   * @returns Wallet address
   */
  connectWallet(privateKey: string, network: string = 'ETHEREUM'): string {
    try {
      const provider = this.getProvider(network);
      const wallet = new ethers.Wallet(privateKey, provider);
      this.wallets.set(network, wallet);
      
      logger.info(`Wallet connected to ${network}: ${wallet.address}`);
      return wallet.address;
    } catch (error) {
      logger.error('Failed to connect wallet', error);
      throw new Error(`Failed to connect wallet: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get connected wallet for a network
   * @param network Network identifier
   * @returns Connected wallet or null
   */
  getWallet(network: string = 'ETHEREUM'): Wallet | null {
    return this.wallets.get(network) || null;
  }
  
  /**
   * Check if the provider is connected
   * @param network Network to check
   * @returns True if connected
   */
  async isConnected(network: string = 'ETHEREUM'): Promise<boolean> {
    try {
      const provider = this.getProvider(network);
      await provider.getNetwork();
      return true;
    } catch (error) {
      return false;
    }
  }
  
//   /**
//    * Get current gas price
//    * @param network Network to check
//    * @returns Gas price in gwei
//    */
//   async getGasPrice(network: string = 'ETHEREUM'): Promise<string> {
//     try {
//       const provider = this.getProvider(network);
//       const gasPrice = await provider.getFeeData();
//       return ethers.formatUnits(gasPrice.gasPrice, 'gwei');
//     } catch (error) {
//       logger.error('Failed to get gas price', error);
//       throw error;
//     }
//   }
  
  /**
   * Get network details
   * @param network Network identifier
   * @returns Network details
   */
  getNetworkDetails(network: string = 'ETHEREUM') {
    const networkKey = network as keyof typeof NETWORKS;
    return NETWORKS[networkKey];
  }
}

export default new BlockchainProviderService(['ETHEREUM', 'POLYGON']);