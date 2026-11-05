import { ethers } from 'ethers';

const DEFAULT_BASE_TOKEN = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ROUTERS = {
  quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
  sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
};
const ROUTER_ABI = ['function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)'];
const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)', 'function decimals() view returns (uint8)'];
const MAX_CONCURRENT_READS = 8;

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      try { results[index] = await mapper(values[index], index); }
      catch (error) { results[index] = { error }; }
    }
  });
  await Promise.all(workers);
  return results;
}

const asNumber = (bigint, decimals) => Number(ethers.formatUnits(bigint, decimals));

class RealDataService {
  constructor(provider, contracts = {}) {
    this.provider = provider;
    this.contracts = contracts;
    this.priceCache = new Map();
    this.inflightPrices = new Map();
    this.cacheTimeout = 30_000;
  }

  async getTokenPrice(tokenAddress, baseToken = DEFAULT_BASE_TOKEN) {
    const key = `${tokenAddress.toLowerCase()}-${baseToken.toLowerCase()}`;
    const cached = this.priceCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.prices;
    if (this.inflightPrices.has(key)) return this.inflightPrices.get(key);

    const request = this.getRouterPrices(tokenAddress, baseToken).then((prices) => {
      this.priceCache.set(key, { prices, timestamp: Date.now() });
      this.inflightPrices.delete(key);
      return prices;
    }).catch((error) => {
      this.inflightPrices.delete(key);
      throw error;
    });
    this.inflightPrices.set(key, request);
    return request;
  }

  async getRouterPrices(tokenAddress, baseToken) {
    if (!this.provider) throw new Error('Provider is not configured');
    const [token, quote] = [
      new ethers.Contract(ethers.getAddress(tokenAddress), ERC20_ABI, this.provider),
      new ethers.Contract(ethers.getAddress(baseToken), ERC20_ABI, this.provider)
    ];
    const [tokenDecimals, quoteDecimals] = await Promise.all([token.decimals(), quote.decimals()]);
    const amountIn = 10n ** BigInt(tokenDecimals);
    const path = [ethers.getAddress(tokenAddress), ethers.getAddress(baseToken)];

    const entries = Object.entries(ROUTERS);
    const results = await Promise.all(entries.map(async ([name, address]) => {
      try {
        const router = new ethers.Contract(address, ROUTER_ABI, this.provider);
        const amounts = await router.getAmountsOut(amountIn, path);
        return { venue: name, price: asNumber(amounts[1], quoteDecimals), ok: true };
      } catch (error) {
        return { venue: name, price: null, ok: false, error: error.shortMessage || error.message };
      }
    }));
    return results;
  }

  async getTokenPriceBestEffort(tokenAddress, baseToken = DEFAULT_BASE_TOKEN) {
    const prices = await this.getTokenPrice(tokenAddress, baseToken);
    return prices.filter((entry) => entry.ok && Number.isFinite(entry.price)).reduce(
      (best, entry) => best === null || entry.price > best ? entry.price : best,
      null
    );
  }

  async readMany(ids, read, limit = MAX_CONCURRENT_READS) {
    return mapLimit(Array.from(ids), limit, read);
  }

  async getArbitrageOpportunities() {
    const contract = this.contracts.hybridDEX;
    if (!contract) return [];
    const ids = await contract.getActiveOpportunities();
    const results = await this.readMany(ids, async (id) => {
      const opp = await contract.getArbitrageOpportunity(id);
      if (!opp.isActive || Number(opp.expiryTime) <= Math.floor(Date.now() / 1000)) return null;
      return {
        id,
        tokenA: opp.tokenA,
        tokenB: opp.tokenB,
        priceA: ethers.formatUnits(opp.priceA, 18),
        priceB: ethers.formatUnits(opp.priceB, 18),
        profitPotential: opp.profitPotential.toString(),
        minAmount: ethers.formatUnits(opp.minAmount, 18),
        maxAmount: ethers.formatUnits(opp.maxAmount, 18),
        expiryTime: new Date(Number(opp.expiryTime) * 1000).toISOString(),
        source: opp.source
      };
    });
    return results.filter((item) => item && !item.error);
  }

  async getLiquidityPools() {
    const contract = this.contracts.hybridDEX;
    if (!contract) return [];
    const ids = await contract.getActivePools();
    const results = await this.readMany(ids, async (id) => {
      const pool = await contract.getLiquidityPool(id);
      if (!pool.isActive) return null;
      return {
        id,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        reserveA: pool.reserveA.toString(),
        reserveB: pool.reserveB.toString(),
        totalSupply: pool.totalSupply.toString(),
        lastUpdateTime: new Date(Number(pool.lastUpdateTime) * 1000).toISOString()
      };
    });
    return results.filter((item) => item && !item.error);
  }

  async getPlatformStats() {
    const contract = this.contracts.hybridDEX;
    if (!contract) return {};
    const stats = await contract.getPlatformStats();
    return {
      totalTrades: stats.totalTradesCount.toString(),
      totalVolume: ethers.formatUnits(stats.totalVolumeAmount, 18),
      totalLiquidity: ethers.formatUnits(stats.totalLiquidityAmount, 18),
      totalFees: ethers.formatUnits(stats.totalFeesAmount, 18)
    };
  }

  async getUserPositions(userAddress) {
    const contract = this.contracts.hybridDEX;
    if (!contract) return [];
    const ids = await contract.getActivePools();
    const results = await this.readMany(ids, async (poolId) => {
      const [position, pool] = await Promise.all([
        contract.getUserPosition(userAddress, poolId),
        contract.getLiquidityPool(poolId)
      ]);
      if (position.liquidity === 0n) return null;
      return {
        poolId,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        liquidity: position.liquidity.toString(),
        tokenAAmount: position.tokenAAmount.toString(),
        tokenBAmount: position.tokenBAmount.toString(),
        lastClaimTime: new Date(Number(position.lastClaimTime) * 1000).toISOString()
      };
    });
    return results.filter((item) => item && !item.error);
  }

  async getGasPrice() {
    if (!this.provider) throw new Error('Provider is not configured');
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice === null ? null : Number(ethers.formatUnits(feeData.gasPrice, 'gwei'));
  }

  async getTokenBalances(userAddress, tokenAddresses) {
    if (!this.provider) throw new Error('Provider is not configured');
    const results = await this.readMany(tokenAddresses, async (address) => {
      const token = new ethers.Contract(ethers.getAddress(address), ERC20_ABI, this.provider);
      const [balance, decimals] = await Promise.all([token.balanceOf(userAddress), token.decimals()]);
      return [address, asNumber(balance, decimals)];
    });
    return Object.fromEntries(results.filter((item) => Array.isArray(item)));
  }

  clearCache() {
    this.priceCache.clear();
    this.inflightPrices.clear();
  }

  setCacheTimeout(timeout) {
    if (!Number.isFinite(timeout) || timeout < 0) throw new Error('Cache timeout must be a non-negative number');
    this.cacheTimeout = timeout;
  }
}

export default RealDataService;
