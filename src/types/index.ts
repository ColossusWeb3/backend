
export interface UploadFile {
  name: string;
  content: string;
  timestamp: Date;
};
export interface ContractConfig {
  address: string;
  abi?: any[];
  providerUrl: string;
  privateKey?: string;
  etherscanApiKey?: string;
  etherscanNetwork?: 'mainnet' | 'ropsten' | 'rinkeby' | 'goerli' | 'kovan' | 'sepolia' | 'arbitrum' | 'optimism' | 'polygon';
};
export interface TokenDetails {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: string;
}

export interface SwapParams {
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  slippageTolerance: number; // percentage, e.g., 0.5 for 0.5%
  deadline: number; // minutes
  gasLimit: number;
  network: string;
  routerAddress: string;
}

export interface TradeResult {
  success: boolean;
  amount: string;
  tokenAddress: string;
  fromTokenAddress?: string;
  transactionHash?: string;
  error?: string;
  type: string;
}
export interface FarcasterDirectCredentials {
  hubUrl: string; // URL to a Farcaster Hub (e.g., 'hub.farcaster.xyz:2283')
  privateKey: string; // Your Ed25519 private key (hex format)
  fid: number; // Your Farcaster ID
}

export interface DirectCastOptions {
  text: string;
  mentionsFids?: number[]; // Optional: FIDs to mention
  replyToFid?: number; // Optional: FID to reply to
  replyToCastHash?: Uint8Array; // Optional: Cast hash to reply to
  embedUrl?: string; // Optional: URL to embed
}