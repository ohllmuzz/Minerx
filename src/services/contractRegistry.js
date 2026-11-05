import { ethers } from 'ethers';

const ABIS = {
  arbxToken: [
    'function balanceOf(address) view returns (uint256)',
    'function getStakingInfo(address) view returns (uint256 staked,uint256 rewards,uint256 startTime,uint256 lastClaim)',
    'function getPlatformStats() view returns (uint256 totalStakedTokens,uint256 totalFees,uint256 circulatingSupply)',
    'function stake(uint256)', 'function unstake(uint256)', 'function claimRewards()'
  ],
  exchange: [
    'function registerUser()',
    'function getPlatformStats() view returns (uint256 totalTradesCount,uint256 totalVolumeAmount,uint256 totalProfitsAmount,uint256 totalFeesAmount)',
    'function getUserInfo(address) view returns (bool isRegistered,uint256 totalTrades,uint256 totalVolume,uint256 totalProfits,uint256 lastTradeTime,uint256 tier)',
    'function getActiveOpportunities() view returns (bytes32[])',
    'function getArbitrageOpportunity(bytes32) view returns (address tokenA,address tokenB,uint256 priceA,uint256 priceB,uint256 profitPotential,uint256 minAmount,uint256 maxAmount,bool isActive,uint256 expiryTime)',
    'function executeArbitrage(bytes32,uint256,address,address)'
  ],
  hybridDEX: [
    'function getActivePools() view returns (bytes32[])',
    'function getLiquidityPool(bytes32) view returns (address tokenA,address tokenB,uint256 reserveA,uint256 reserveB,uint256 totalSupply,bool isActive,uint256 lastUpdateTime)',
    'function getUserPosition(address,bytes32) view returns (uint256 liquidity,uint256 tokenAAmount,uint256 tokenBAmount,uint256 lastClaimTime)',
    'function getPlatformStats() view returns (uint256 totalTradesCount,uint256 totalVolumeAmount,uint256 totalLiquidityAmount,uint256 totalFeesAmount)',
    'function getActiveOpportunities() view returns (bytes32[])',
    'function getArbitrageOpportunity(bytes32) view returns (address tokenA,address tokenB,uint256 priceA,uint256 priceB,uint256 profitPotential,uint256 minAmount,uint256 maxAmount,bool isActive,uint256 expiryTime,string source)',
    'function createLiquidityPool(address,address)',
    'function createArbitrageOpportunity(address,address,uint256,uint256,uint256)',
    'function setFees(uint256,uint256,uint256)', 'function pause()', 'function unpause()'
  ],
  bot: [
    'function scanArbitrageOpportunities() view returns (address[] tokenPairs,uint256[] profitPotentials,uint256[] optimalAmounts)',
    'function executeArbitrage(address,address,uint256) returns (bool success,uint256 profit)',
    'function setConfiguration(uint256,uint256,uint256)'
  ]
};

export function createContracts(addresses, signerOrProvider) {
  if (!addresses || !signerOrProvider) throw new Error('Contract addresses and signer/provider are required');

  return Object.fromEntries(Object.entries(ABIS).map(([name, abi]) => {
    const address = addresses[name];
    if (!ethers.isAddress(address || '') || address === ethers.ZeroAddress) {
      throw new Error(`Invalid contract address for ${name}`);
    }
    return [name, new ethers.Contract(ethers.getAddress(address), abi, signerOrProvider)];
  }));
}

export const contractInterfaces = ABIS;
