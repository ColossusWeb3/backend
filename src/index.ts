import express from 'express';
import { config, validateConfig } from './config/config';
import { IPFSService } from './services/storage/ipfsService';
import { FarcasterService, FarcasterCredentials } from './services/social/farcasterService';
import { ContractInteractionService} from './services/contracts/interact';
import { BlockchainProviderService } from './services/providers/blockchainProviders';
import {ethers} from 'ethers';

async function main() {
  try {
    // Validate configuration
    validateConfig();
    console.log(`${config.provider.rpcUrl}`);
    
    // Initialize services
    const ipfsService = new IPFSService();
    const ProviderService = new BlockchainProviderService(['ETHEREUM']);
    const isConnected = await ProviderService.isConnected();
    if (!isConnected){
        throw new Error('Failed to connect to ethereum network');
    }
    const contractService = new ContractInteractionService({
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI token contract
        providerUrl: config.provider.rpcUrl,
        etherscanApiKey: config.etherscan.apiKey,
        etherscanNetwork: 'mainnet' 
      });

    // await contractService.initialize();

    // const totalSupply = await contractService.call('totalSupply');
    // console.log(`Total supply: ${ethers.formatEther(totalSupply)}`);
    
    // Your credentials from Neynar
    const credentials: FarcasterCredentials = {
      apiKey: config.farcaster.neynarApiKey,
      signerUuid: config.farcaster.signerUuid,
      fid: config.farcaster.fid // Your Farcaster ID
    };
    const farcasterService = new FarcasterService(credentials);
    try {
      const result = await farcasterService.postCast({
        text: "Hello Farcaster! This is my first cast from my Node.js app."
      });
      console.log('Cast posted successfully:', result);
    } catch (error) {
      console.error('Failed to post cast:', error);
    }

    // Initialize Express
    const app = express();
    app.use(express.json());
    
    // Define routes
    app.post('/api/storage/upload', async (req, res) => {
      try {
        const { data } = req.body;
        const cid = await ipfsService.uploadJSON(data);
        res.json({ success: true, cid });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    app.get('/api/storage/:cid', async (req, res) => {
      try {
        const { cid } = req.params;
        const data = await ipfsService.fetchData(cid);
        res.json({ success: true, data });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    app.get('/api/storage/status/:cid', async (req, res) => {
      try {
        const { cid } = req.params;
        const status = await ipfsService.getStatus(cid);
        res.json({ success: true, status });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Start server
    app.listen(config.server.port, () => {
      console.log(`Server started on port ${config.server.port}`);
    });
    
  } catch (error: any) {
    console.error('Error starting application:', error.message);
    process.exit(1);
  }
}

// Run the application
main();