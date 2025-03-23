// src/services/priceOracle.ts
import axios from 'axios';
import { Contract, ethers, Provider } from 'ethers';
import { API_KEYS } from '../../config';
import {BlockchainProviderService} from '../providers/blockchainProviders';
import createLogger from '../../utils/logger';

const logger = createLogger('PriceOracleService');

// Cache for token prices to avoid excessive API calls
const priceCache: {
  [key: string]: {
    price: string;
    timestamp: number;
  }
} = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Uniswap V2 pair ABI (minimal)
const UNISWAP_V2_PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
];

// ChainLink price feed ABI (minimal)
const CHAINLINK_PRICE_FEED_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)'
];

// Common price feed addresses (Ethereum mainnet)
const PRICE_FEEDS: { [symbol: string]: string } = {
  'WETH': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
  'WBTC': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
  'DAI': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',  // DAI/USD
  'USDC': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
  'USDT': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', // USDT/USD
  // Add more as needed
};

// Data sources for price fetching
enum PriceSource {
  CHAINLINK,
  UNISWAP_V2
}

export class PriceOracleService {
  private provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  /**
   * Get token price in USD
   * @param tokenAddress The token address
   * @param network The network name
   * @param preferredSources Optional array of preferred price sources in order of preference
   * @returns Promise with the token price in USD as a string
   */
  async getTokenPrice(
    tokenAddress: string, 
    network: string,
    preferredSource: PriceSource = PriceSource.UNISWAP_V2
  ): Promise<string> {
    // Check cache first
    const cacheKey = `${tokenAddress.toLowerCase()}_${network}`;
    if (priceCache[cacheKey] && 
        Date.now() - priceCache[cacheKey].timestamp < CACHE_EXPIRATION) {
      logger.debug(`Using cached price for ${cacheKey}`);
      return priceCache[cacheKey].price;
    }

    let price: string | null = null;

    try {
        price = await this.getPriceFromUniswapV2(tokenAddress, network);

        if (price) {
            // Update cache and return price
            priceCache[cacheKey] = {
            price,
            timestamp: Date.now()
            };
            return price;
        }
    } catch (error: any) {
        logger.error(`Error getting price from source ${preferredSource}: ${error.message}`);
    }
    throw new Error(`Unable to get price for token ${tokenAddress} on ${network}`);
  }

  /**
   * Get token price from Chainlink price feeds
   */
  private async getPriceFromChainlink(tokenAddress: string, network: string): Promise<string | null> {
    // Get token symbol
    const tokenContract = new Contract(
      tokenAddress,
      ['function symbol() view returns (string)'],
      this.provider
    );
    
    let symbol;
    try {
      symbol = await tokenContract.symbol();
    } catch (error: any) {
      logger.error(`Could not get symbol for token ${tokenAddress}: ${error.message}`);
      return null;
    }

    const priceFeedAddress = PRICE_FEEDS[symbol];
    if (!priceFeedAddress) {
      logger.debug(`No Chainlink price feed found for ${symbol}`);
      return null;
    }

    const priceFeed = new Contract(
      priceFeedAddress,
      CHAINLINK_PRICE_FEED_ABI,
      this.provider
    );

    const [, answer] = await priceFeed.latestRoundData();
    const decimals = await priceFeed.decimals();

    // Convert price to USD with proper decimals
    const price = ethers.formatUnits(answer, decimals);
    logger.info(`Got price for ${symbol} from Chainlink: $${price}`);
    
    return price;
  }

  /**
   * Get token price from Uniswap V2 pairs
   */
  private async getPriceFromUniswapV2(tokenAddress: string, network: string): Promise<string | null> {
    // This implementation assumes existence of a known WETH-Token pair
    // You would need a registry or factory to find the pair address in production
    
    const provider = this.provider;
    
    // For this example, we'll assume we're looking for a token-WETH pair
    // In a real implementation, you'd query a factory contract to find pairs
    
    // Placeholder for pair address lookup - in production this would query Uniswap factory
    const pairAddress = await this.findUniswapPairAddress(tokenAddress, network);
    
    if (!pairAddress) {
      logger.debug(`No Uniswap V2 pair found for token ${tokenAddress}`);
      return null;
    }
    
    const pairContract = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
    
    // Get tokens in the pair
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();
    
    // Get reserves
    const [reserve0, reserve1] = await pairContract.getReserves();
    
    // Determine which token is WETH and which is our target
    const wethAddressOnNetwork = this.getWethAddress(network);
    
    // If neither token is WETH, we can't calculate the price directly
    if (token0.toLowerCase() !== wethAddressOnNetwork.toLowerCase() && 
        token1.toLowerCase() !== wethAddressOnNetwork.toLowerCase()) {
      logger.debug(`Pair does not contain WETH, can't calculate direct price`);
      return null;
    }
    
    // Get WETH price in USD (from Chainlink or another reliable source)
    const wethPrice = await this.getPriceFromChainlink(wethAddressOnNetwork, network);
    if (!wethPrice) {
      logger.error(`Could not get WETH price to calculate token price`);
      return null;
    }
    
    // Calculate token price based on reserves
    let tokenPrice: string;
    
    if (token0.toLowerCase() === wethAddressOnNetwork.toLowerCase()) {
      // token0 is WETH, token1 is our target
      // Price = (reserve0 * wethPrice) / reserve1
      tokenPrice = (Number(ethers.formatEther(reserve0)) * Number(wethPrice) / 
                    Number(ethers.formatEther(reserve1))).toString();
    } else {
      // token1 is WETH, token0 is our target
      // Price = (reserve1 * wethPrice) / reserve0
      tokenPrice = (Number(ethers.formatEther(reserve1)) * Number(wethPrice) / 
                    Number(ethers.formatEther(reserve0))).toString();
    }
    
    logger.info(`Got price for ${tokenAddress} from Uniswap V2: $${tokenPrice}`);
    return tokenPrice;
  }

  /**
   * Find Uniswap pair address for a given token
   * In a real implementation, this would query the Uniswap factory
   */
  private async findUniswapPairAddress(tokenAddress: string, network: string): Promise<string | null> {
    // This is a placeholder - in a real implementation you would:
    // 1. Get the Uniswap Factory contract for the network
    // 2. Query getPair(tokenAddress, WETH address) to get the pair address
    
    // Example implementation (factory addresses would be in config):
    const factoryAddresses: { [network: string]: string } = {
      'mainnet': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      'goerli': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      // Add other networks as needed
    };
    
    const factoryAddress = factoryAddresses[network];
    if (!factoryAddress) {
      logger.debug(`No Uniswap factory address configured for network ${network}`);
      return null;
    }
    
    const factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ];
    
    const factory = new Contract(
      factoryAddress,
      factoryABI,
      this.provider
    );
    
    const wethAddress = this.getWethAddress(network);
    const pairAddress = await factory.getPair(tokenAddress, wethAddress);
    
    // If zero address is returned, no pair exists
    if (pairAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    
    return pairAddress;
  }

  /**
   * Get WETH address for a given network
   */
  private getWethAddress(network: string): string {
    const wethAddresses: { [network: string]: string } = {
      'mainnet': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      'goerli': '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
      // Add other networks as needed
    };
    
    const wethAddress = wethAddresses[network];
    if (!wethAddress) {
      throw new Error(`No WETH address configured for network ${network}`);
    }
    
    return wethAddress;
  }

  /**
   * Clear the cache or remove specific entries
   * @param tokenAddress Optional token address to clear
   * @param network Optional network to clear
   */
  clearCache(tokenAddress?: string, network?: string): void {
    if (tokenAddress && network) {
      // Clear specific token on specific network
      const cacheKey = `${tokenAddress.toLowerCase()}_${network}`;
      delete priceCache[cacheKey];
      logger.debug(`Cleared price cache for ${cacheKey}`);
    } else if (tokenAddress) {
      // Clear all networks for this token
      Object.keys(priceCache).forEach(key => {
        if (key.startsWith(`${tokenAddress.toLowerCase()}_`)) {
          delete priceCache[key];
        }
      });
      logger.debug(`Cleared price cache for token ${tokenAddress} on all networks`);
    } else if (network) {
      // Clear all tokens on this network
      Object.keys(priceCache).forEach(key => {
        if (key.endsWith(`_${network}`)) {
          delete priceCache[key];
        }
      });
      logger.debug(`Cleared price cache for all tokens on network ${network}`);
    } else {
      // Clear entire cache
      Object.keys(priceCache).forEach(key => {
        delete priceCache[key];
      });
      logger.debug('Cleared entire price cache');
    }
  }
}

export default PriceOracleService;