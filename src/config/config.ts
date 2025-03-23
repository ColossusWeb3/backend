import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  lighthouse: {
    apiKey: string;
  };
  etherscan: {
    apiKey: string;
  };
  server: {
    port: number;
  };
  provider: {
    rpcUrl: string;
  };
  farcaster: {
    neynarApiKey: string;
    signerUuid: string;
    fid: number;
  }
}

const config: Config = {
  lighthouse: {
    apiKey: process.env.LIGHTHOUSE_API_KEY || '',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  provider: {
    rpcUrl: process.env.RPC_URL || '',
  },
  farcaster:{
    neynarApiKey: process.env.NEYNAR_API_KEY || '',
    fid: parseInt(process.env.FARCASTER_ID || '', 10),
    signerUuid: process.env.FARCASTER_SIGNER_UUID || '',
  }
};

// Validate required configs
const validateConfig = () => {
  if (!config.lighthouse.apiKey) {
    throw new Error('LIGHTHOUSE_API_KEY is required');
  }
  if (!config.etherscan.apiKey) {
    throw new Error('LIGHTHOUSE_API_KEY is required');
  }
  if (!config.provider.rpcUrl) {
    throw new Error('LIGHTHOUSE_API_KEY is required');
  }
};

export { config, validateConfig };