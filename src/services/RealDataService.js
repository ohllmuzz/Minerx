import { ethers } from 'ethers';
import axios from 'axios';

class RealDataService {
    constructor(provider, contracts) {
        this.provider = provider;
        this.contracts = contracts;
        this.priceCache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
    }

    // Get real token price from blockchain
    async getTokenPrice(tokenAddress, baseToken = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174') { // USDC
        try {
            const cacheKey = `${tokenAddress}-${baseToken}`;
            const cached = this.priceCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.price;
            }

            // Get price from QuickSwap
            const quickswapPrice = await this.getQuickSwapPrice(tokenAddress, baseToken);
            
            // Get price from SushiSwap
            const sushiswapPrice = await this.getSushiSwapPrice(tokenAddress, baseToken);
            
            // Use the better price (higher for selling, lower for buying)
            const price = quickswapPrice > 0 && sushiswapPrice > 0 
                ? Math.max(quickswapPrice, sushiswapPrice)
                : Math.max(quickswapPrice, sushiswapPrice);

            this.priceCache.set(cacheKey, {
                price,
                timestamp: Date.now()
            });

            return price;
        } catch (error) {
            console.error('Error getting token price:', error);
            return 0;
        }
    }

    // Get price from QuickSwap
    async getQuickSwapPrice(tokenAddress, baseToken) {
        try {
            if (!this.contracts.hybridDEX) return 0;

            const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
            const router = new ethers.Contract(
                QUICKSWAP_ROUTER,
                [
                    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
                ],
                this.provider
            );

            const amountIn = ethers.utils.parseEther("1");
            const path = [tokenAddress, baseToken];
            
            const amounts = await router.getAmountsOut(amountIn, path);
            return parseFloat(ethers.utils.formatUnits(amounts[1], 6)); // USDC has 6 decimals
        } catch (error) {
            console.error('Error getting QuickSwap price:', error);
            return 0;
        }
    }

    // Get price from SushiSwap
    async getSushiSwapPrice(tokenAddress, baseToken) {
        try {
            if (!this.contracts.hybridDEX) return 0;

            const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
            const router = new ethers.Contract(
                SUSHISWAP_ROUTER,
                [
                    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
                ],
                this.provider
            );

            const amountIn = ethers.utils.parseEther("1");
            const path = [tokenAddress, baseToken];
            
            const amounts = await router.getAmountsOut(amountIn, path);
            return parseFloat(ethers.utils.formatUnits(amounts[1], 6)); // USDC has 6 decimals
        } catch (error) {
            console.error('Error getting SushiSwap price:', error);
            return 0;
        }
    }

    // Get real arbitrage opportunities from blockchain
    async getArbitrageOpportunities() {
        try {
            if (!this.contracts.hybridDEX) return [];

            const opportunities = await this.contracts.hybridDEX.getActiveOpportunities();
            const opportunitiesData = [];

            for (const oppId of opportunities) {
                const opp = await this.contracts.hybridDEX.getArbitrageOpportunity(oppId);
                
                if (opp.isActive && opp.expiryTime > Math.floor(Date.now() / 1000)) {
                    opportunitiesData.push({
                        id: oppId,
                        tokenA: opp.tokenA,
                        tokenB: opp.tokenB,
                        priceA: parseFloat(ethers.utils.formatEther(opp.priceA)),
                        priceB: parseFloat(ethers.utils.formatEther(opp.priceB)),
                        profitPotential: opp.profitPotential.toString(),
                        minAmount: parseFloat(ethers.utils.formatEther(opp.minAmount)),
                        maxAmount: parseFloat(ethers.utils.formatEther(opp.maxAmount)),
                        expiryTime: new Date(opp.expiryTime * 1000).toLocaleString(),
                        source: opp.source
                    });
                }
            }

            return opportunitiesData;
        } catch (error) {
            console.error('Error getting arbitrage opportunities:', error);
            return [];
        }
    }

    // Get real liquidity pools from blockchain
    async getLiquidityPools() {
        try {
            if (!this.contracts.hybridDEX) return [];

            const pools = await this.contracts.hybridDEX.getActivePools();
            const poolsData = [];

            for (const poolId of pools) {
                const pool = await this.contracts.hybridDEX.getLiquidityPool(poolId);
                
                if (pool.isActive) {
                    poolsData.push({
                        id: poolId,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        reserveA: parseFloat(ethers.utils.formatEther(pool.reserveA)),
                        reserveB: parseFloat(ethers.utils.formatEther(pool.reserveB)),
                        totalSupply: parseFloat(ethers.utils.formatEther(pool.totalSupply)),
                        lastUpdateTime: new Date(pool.lastUpdateTime * 1000).toLocaleString()
                    });
                }
            }

            return poolsData;
        } catch (error) {
            console.error('Error getting liquidity pools:', error);
            return [];
        }
    }

    // Get real platform statistics from blockchain
    async getPlatformStats() {
        try {
            if (!this.contracts.hybridDEX) return {};

            const stats = await this.contracts.hybridDEX.getPlatformStats();
            
            return {
                totalTrades: stats.totalTradesCount.toString(),
                totalVolume: parseFloat(ethers.utils.formatEther(stats.totalVolumeAmount)),
                totalLiquidity: parseFloat(ethers.utils.formatEther(stats.totalLiquidityAmount)),
                totalFees: parseFloat(ethers.utils.formatEther(stats.totalFeesAmount))
            };
        } catch (error) {
            console.error('Error getting platform stats:', error);
            return {};
        }
    }

    // Get real user positions from blockchain
    async getUserPositions(userAddress) {
        try {
            if (!this.contracts.hybridDEX) return [];

            const pools = await this.contracts.hybridDEX.getActivePools();
            const positions = [];

            for (const poolId of pools) {
                const position = await this.contracts.hybridDEX.getUserPosition(userAddress, poolId);
                
                if (position.liquidity > 0) {
                    const pool = await this.contracts.hybridDEX.getLiquidityPool(poolId);
                    
                    positions.push({
                        poolId,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        liquidity: parseFloat(ethers.utils.formatEther(position.liquidity)),
                        tokenAAmount: parseFloat(ethers.utils.formatEther(position.tokenAAmount)),
                        tokenBAmount: parseFloat(ethers.utils.formatEther(position.tokenBAmount)),
                        lastClaimTime: new Date(position.lastClaimTime * 1000).toLocaleString()
                    });
                }
            }

            return positions;
        } catch (error) {
            console.error('Error getting user positions:', error);
            return [];
        }
    }

    // Get real gas price from blockchain
    async getGasPrice() {
        try {
            const gasPrice = await this.provider.getGasPrice();
            return parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
        } catch (error) {
            console.error('Error getting gas price:', error);
            return 0;
        }
    }

    // Get real token balances from blockchain
    async getTokenBalances(userAddress, tokenAddresses) {
        try {
            const balances = {};
            
            for (const tokenAddress of tokenAddresses) {
                const token = new ethers.Contract(
                    tokenAddress,
                    ['function balanceOf(address owner) view returns (uint256)'],
                    this.provider
                );
                
                const balance = await token.balanceOf(userAddress);
                balances[tokenAddress] = parseFloat(ethers.utils.formatEther(balance));
            }
            
            return balances;
        } catch (error) {
            console.error('Error getting token balances:', error);
            return {};
        }
    }

    // Get real market data from external APIs (as backup)
    async getMarketData(symbol) {
        try {
            // Use CoinGecko API as backup for market data
            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
            return response.data[symbol]?.usd || 0;
        } catch (error) {
            console.error('Error getting market data:', error);
            return 0;
        }
    }

    // Clear price cache
    clearCache() {
        this.priceCache.clear();
    }

    // Update cache timeout
    setCacheTimeout(timeout) {
        this.cacheTimeout = timeout;
    }
}

export default RealDataService; 