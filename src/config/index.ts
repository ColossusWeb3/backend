// src/config/index.ts
import dotenv from 'dotenv';
import { ethers, Provider } from 'ethers';

// Load environment variables
dotenv.config();

// Network configurations for different chains
export const NETWORKS = {
  ETHEREUM: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.RPC_URL || '',
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  POLYGON: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  },
  // Add other networks as needed
};

// Common DEX router addresses
export const DEX_ROUTERS = {
  UNISWAP_V2: process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  SUSHISWAP: process.env.SUSHISWAP_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  QUICKSWAP: process.env.QUICKSWAP_ROUTER || '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
};

// Default slippage tolerance for swaps (in percentage)
export const DEFAULT_SLIPPAGE = process.env.DEFAULT_SLIPPAGE ? 
  parseFloat(process.env.DEFAULT_SLIPPAGE) : 0.5;

// Default gas price strategy
export const GAS_PRICE_STRATEGY = process.env.GAS_PRICE_STRATEGY || 'medium'; // low, medium, high, fastest

// Timeout for transactions (in milliseconds)
export const TRANSACTION_TIMEOUT = process.env.TRANSACTION_TIMEOUT ? 
  parseInt(process.env.TRANSACTION_TIMEOUT) : 60000;

// Maximum number of retries for failed transactions
export const MAX_TRANSACTION_RETRIES = process.env.MAX_TRANSACTION_RETRIES ? 
  parseInt(process.env.MAX_TRANSACTION_RETRIES) : 3;

// API keys for external services
export const API_KEYS = {
  INFURA: process.env.RPC_URL || '',
  ETHERSCAN: process.env.ETHERSCAN_API_KEY || '',
};

// Create a default provider
export function getProvider(network = 'ETHEREUM'): Provider {
  const selectedNetwork = NETWORKS[network as keyof typeof NETWORKS];
  
  if (!selectedNetwork) {
    throw new Error(`Network ${network} not supported`);
  }
  
  return new ethers.JsonRpcProvider(selectedNetwork.rpcUrl);
}

// Environment check
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';