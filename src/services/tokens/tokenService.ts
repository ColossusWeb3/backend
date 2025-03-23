// // src/services/tokenService.ts
// import { ethers, Contract } from 'ethers';
// import BlockchainProvidersService from '../providers/blockchainProviders';
// import { DEFAULT_SLIPPAGE, DEX_ROUTERS, TRANSACTION_TIMEOUT } from '../../config';
// import { TokenDetails, SwapParams, TradeResult } from '../../types';
// import { PriceOracleService } from '../tokens/priceOracles';
// import createLogger from '../../utils/logger';
// // import { waitForTransaction } from './transactionManager';

// // // ABI imports
// // import ERC20_ABI from '../abis/ERC20.json';
// // import UNISWAP_V2_ROUTER_ABI from '../abis/UniswapV2Router.json';

// const logger = createLogger("Token Service");

// export class TokenService {
//   /**
//    * Get token details including symbol, name, decimals
//    * @param tokenAddress Token contract address
//    * @param network Network where token exists
//    * @returns Token details
//    */
//   async getTokenDetails(tokenAddress: string, network: string = 'ETHEREUM'): Promise<TokenDetails> {
//     try {
//       const provider = BlockchainProvidersService.getProvider(network);
//       const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      
//       const [name, symbol, decimals] = await Promise.all([
//         tokenContract.name(),
//         tokenContract.symbol(),
//         tokenContract.decimals()
//       ]);

//       const priceOracle = new PriceOracleService(provider);
//       const price = await priceOracle.getTokenPrice(tokenAddress, network);
      
//       return {
//         address: tokenAddress,
//         name,
//         symbol,
//         decimals,
//         price
//       };
//     } catch (error) {
//       logger.error(`Failed to get token details for ${tokenAddress}`, error);
//       throw new Error(`Failed to get token details: ${(error as Error).message}`);
//     }
//   }
  
//   /**
//    * Get token balance for an address
//    * @param tokenAddress Token contract address
//    * @param walletAddress Wallet address
//    * @param network Network where token exists
//    * @returns Token balance formatted with proper decimals
//    */
//   async getTokenBalance(
//     tokenAddress: string, 
//     walletAddress: string, 
//     network: string = 'ETHEREUM'
//   ): Promise<string> {
//     try {
//       const provider = BlockchainProvidersService.getProvider(network);
//       const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      
//       const decimals = await tokenContract.decimals();
//       const balance = await tokenContract.balanceOf(walletAddress);
      
//       return ethers.formatUnits(balance, decimals);
//     } catch (error) {
//       logger.error(`Failed to get token balance for ${walletAddress}`, error);
//       throw new Error(`Failed to get token balance: ${(error as Error).message}`);
//     }
//   }
  
//   /**
//    * Swap tokens (token to token)
//    * @param params Swap parameters
//    * @returns Transaction result
//    */
//   async swapTokens(params: SwapParams): Promise<TradeResult> {
//     const {
//       fromTokenAddress,
//       toTokenAddress,
//       amount,
//       slippageTolerance = DEFAULT_SLIPPAGE,
//       deadline = Math.floor(Date.now() / 1000) + 20 * 60,
//       network = 'ETHEREUM',
//       routerAddress = DEX_ROUTERS.UNISWAP_V2
//     } = params;
    
//     const wallet = BlockchainProvidersService.getWallet(network);
//     if (!wallet) {
//       throw new Error('No wallet connected');
//     }
    
//     try {
//       const router = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, wallet);
//       const fromTokenContract = new Contract(fromTokenAddress, ERC20_ABI, wallet);
//       const fromTokenDetails = await this.getTokenDetails(fromTokenAddress, network);
//       const toTokenDetails = await this.getTokenDetails(toTokenAddress, network);
      
//       // Calculate path
//       const WETH = await router.WETH();
//       let path: string[];
      
//       // Direct path if possible, otherwise route through native token
//       const directPath = [fromTokenAddress, toTokenAddress];
//       try {
//         await router.getAmountsOut(ethers.parseUnits('1', fromTokenDetails.decimals), directPath);
//         path = directPath;
//       } catch (e) {
//         path = [fromTokenAddress, WETH, toTokenAddress];
//       }
      
//       // Parse amount with proper decimals
//       const amountIn = ethers.parseUnits(amount, fromTokenDetails.decimals);
      
//       // Check and approve allowance if needed
//       const allowance = await fromTokenContract.allowance(wallet.address, routerAddress);
//       if (allowance.lt(amountIn)) {
//         const approveTx = await fromTokenContract.approve(routerAddress, ethers.MaxUint256);
//         await approveTx.wait();
//         logger.info(`Approved token spending for ${fromTokenAddress}`);
//       }
      
//       // Calculate minimum amount out with slippage
//       const amounts = await router.getAmountsOut(amountIn, path);
//       const amountOutMin = amounts[amounts.length - 1].mul(
//         BigInt(10000 - Math.floor(slippageTolerance * 100))
//       ).div(BigInt(10000));
      
//       // Execute swap transaction
//       const tx = await router.swapExactTokensForTokens(
//         amountIn,
//         amountOutMin,
//         path,
//         wallet.address,
//         deadline
//       );
      
//       logger.info(`Token swap transaction submitted: ${tx.hash}`);
      
//       // Wait for transaction confirmation
//       const receipt = await waitForTransaction(tx.hash, network);
      
//       return {
//         success: receipt.status === 1,
//         transactionHash: tx.hash,
//         amount: ethers.formatUnits(amounts[amounts.length - 1], toTokenDetails.decimals),
//         tokenAddress: toTokenAddress,
//         fromTokenAddress,
//         type: 'SWAP'
//       };
//     } catch (error) {
//       logger.error('Swap tokens failed', error);
//       throw new Error(`Failed to swap tokens: ${(error as Error).message}`);
//     }
//   }
// }

// export default new TokenService();