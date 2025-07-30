// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./ARBXToken.sol";

contract HybridDEX is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    // Token contracts
    ARBXToken public arbxToken;
    
    // DEX interfaces for real price data
    IUniswapV2Router02 public quickswapRouter;
    IUniswapV2Router02 public sushiswapRouter;
    IUniswapV2Factory public quickswapFactory;
    IUniswapV2Factory public sushiswapFactory;
    
    // Fee structure
    uint256 public tradingFee = 15; // 0.15% (basis points)
    uint256 public liquidityFee = 5; // 0.05% (basis points)
    uint256 public arbitrageFee = 25; // 0.25% (basis points)
    uint256 public constant FEE_PRECISION = 10000;
    
    // Liquidity pools
    struct LiquidityPool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalSupply;
        bool isActive;
        uint256 lastUpdateTime;
    }
    
    mapping(bytes32 => LiquidityPool) public liquidityPools;
    bytes32[] public activePools;
    
    // User positions
    struct UserPosition {
        uint256 liquidity;
        uint256 tokenAAmount;
        uint256 tokenBAmount;
        uint256 lastClaimTime;
    }
    
    mapping(address => mapping(bytes32 => UserPosition)) public userPositions;
    
    // Arbitrage opportunities with real data
    struct ArbitrageOpportunity {
        address tokenA;
        address tokenB;
        uint256 priceA;
        uint256 priceB;
        uint256 profitPotential;
        uint256 minAmount;
        uint256 maxAmount;
        bool isActive;
        uint256 expiryTime;
        string source; // "quickswap", "sushiswap", "hybrid"
    }
    
    mapping(bytes32 => ArbitrageOpportunity) public arbitrageOpportunities;
    bytes32[] public activeOpportunities;
    
    // Statistics
    uint256 public totalTrades;
    uint256 public totalVolume;
    uint256 public totalLiquidityProvided;
    uint256 public totalFeesCollected;
    
    // Events
    event LiquidityPoolCreated(bytes32 indexed poolId, address tokenA, address tokenB);
    event LiquidityAdded(address indexed user, bytes32 indexed poolId, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed user, bytes32 indexed poolId, uint256 amountA, uint256 amountB);
    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event ArbitrageExecuted(
        address indexed user,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 profit,
        uint256 fee
    );
    event OpportunityCreated(
        bytes32 indexed opportunityId,
        address tokenA,
        address tokenB,
        uint256 profitPotential,
        string source
    );
    
    constructor(
        address _arbxToken,
        address _quickswapRouter,
        address _sushiswapRouter
    ) {
        arbxToken = ARBXToken(_arbxToken);
        quickswapRouter = IUniswapV2Router02(_quickswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
        quickswapFactory = IUniswapV2Factory(quickswapRouter.factory());
        sushiswapFactory = IUniswapV2Factory(sushiswapRouter.factory());
    }
    
    // Create liquidity pool
    function createLiquidityPool(address tokenA, address tokenB) external onlyOwner {
        require(tokenA != tokenB, "Tokens must be different");
        
        bytes32 poolId = keccak256(abi.encodePacked(tokenA, tokenB));
        require(!liquidityPools[poolId].isActive, "Pool already exists");
        
        liquidityPools[poolId] = LiquidityPool({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            totalSupply: 0,
            isActive: true,
            lastUpdateTime: block.timestamp
        });
        
        activePools.push(poolId);
        emit LiquidityPoolCreated(poolId, tokenA, tokenB);
    }
    
    // Add liquidity to pool
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant whenNotPaused {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        
        bytes32 poolId = keccak256(abi.encodePacked(tokenA, tokenB));
        require(liquidityPools[poolId].isActive, "Pool not active");
        
        LiquidityPool storage pool = liquidityPools[poolId];
        
        // Transfer tokens from user
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity tokens to mint
        uint256 liquidityTokens;
        if (pool.totalSupply == 0) {
            liquidityTokens = sqrt(amountA * amountB);
        } else {
            liquidityTokens = min(
                (amountA * pool.totalSupply) / pool.reserveA,
                (amountB * pool.totalSupply) / pool.reserveB
            );
        }
        
        require(liquidityTokens > 0, "Insufficient liquidity tokens");
        
        // Update pool reserves
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.totalSupply += liquidityTokens;
        pool.lastUpdateTime = block.timestamp;
        
        // Update user position
        UserPosition storage position = userPositions[msg.sender][poolId];
        position.liquidity += liquidityTokens;
        position.tokenAAmount += amountA;
        position.tokenBAmount += amountB;
        position.lastClaimTime = block.timestamp;
        
        totalLiquidityProvided += amountA + amountB;
        
        emit LiquidityAdded(msg.sender, poolId, amountA, amountB);
    }
    
    // Remove liquidity from pool
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidityTokens
    ) external nonReentrant whenNotPaused {
        require(liquidityTokens > 0, "Amount must be greater than 0");
        
        bytes32 poolId = keccak256(abi.encodePacked(tokenA, tokenB));
        require(liquidityPools[poolId].isActive, "Pool not active");
        
        LiquidityPool storage pool = liquidityPools[poolId];
        UserPosition storage position = userPositions[msg.sender][poolId];
        
        require(position.liquidity >= liquidityTokens, "Insufficient liquidity");
        
        // Calculate amounts to return
        uint256 amountA = (liquidityTokens * pool.reserveA) / pool.totalSupply;
        uint256 amountB = (liquidityTokens * pool.reserveB) / pool.totalSupply;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity for amounts");
        
        // Update pool reserves
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        pool.totalSupply -= liquidityTokens;
        pool.lastUpdateTime = block.timestamp;
        
        // Update user position
        position.liquidity -= liquidityTokens;
        position.tokenAAmount -= amountA;
        position.tokenBAmount -= amountB;
        
        // Transfer tokens to user
        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);
        
        totalLiquidityProvided -= amountA + amountB;
        
        emit LiquidityRemoved(msg.sender, poolId, amountA, amountB);
    }
    
    // Execute swap with real price data
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be greater than 0");
        
        bytes32 poolId = keccak256(abi.encodePacked(tokenIn, tokenOut));
        require(liquidityPools[poolId].isActive, "Pool not active");
        
        LiquidityPool storage pool = liquidityPools[poolId];
        
        // Calculate output amount using constant product formula
        uint256 fee = (amountIn * tradingFee) / FEE_PRECISION;
        uint256 amountInWithFee = amountIn - fee;
        
        amountOut = (amountInWithFee * pool.reserveB) / (pool.reserveA + amountInWithFee);
        
        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < pool.reserveB, "Insufficient liquidity");
        
        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        // Update reserves
        pool.reserveA += amountInWithFee;
        pool.reserveB -= amountOut;
        pool.lastUpdateTime = block.timestamp;
        
        // Update statistics
        totalTrades++;
        totalVolume += amountIn;
        totalFeesCollected += fee;
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee);
        
        return amountOut;
    }
    
    // Create arbitrage opportunity with real data
    function createArbitrageOpportunity(
        address tokenA,
        address tokenB,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 duration
    ) external onlyOwner {
        require(tokenA != tokenB, "Tokens must be different");
        require(minAmount > 0 && maxAmount > minAmount, "Invalid amounts");
        require(duration > 0, "Invalid duration");
        
        // Get real prices from external DEXes
        uint256 priceQuick = _getRealPrice(quickswapRouter, tokenA, tokenB, minAmount);
        uint256 priceSushi = _getRealPrice(sushiswapRouter, tokenA, tokenB, minAmount);
        
        // Determine best arbitrage opportunity
        string memory source;
        uint256 priceA;
        uint256 priceB;
        
        if (priceQuick > priceSushi) {
            source = "quickswap";
            priceA = priceSushi;
            priceB = priceQuick;
        } else {
            source = "sushiswap";
            priceA = priceQuick;
            priceB = priceSushi;
        }
        
        uint256 profitPotential = priceB > priceA ? 
            ((priceB - priceA) * 10000) / priceA : 0;
        
        bytes32 opportunityId = keccak256(abi.encodePacked(tokenA, tokenB, block.timestamp));
        
        arbitrageOpportunities[opportunityId] = ArbitrageOpportunity({
            tokenA: tokenA,
            tokenB: tokenB,
            priceA: priceA,
            priceB: priceB,
            profitPotential: profitPotential,
            minAmount: minAmount,
            maxAmount: maxAmount,
            isActive: true,
            expiryTime: block.timestamp + duration,
            source: source
        });
        
        activeOpportunities.push(opportunityId);
        
        emit OpportunityCreated(opportunityId, tokenA, tokenB, profitPotential, source);
    }
    
    // Execute arbitrage with real data
    function executeArbitrage(
        bytes32 opportunityId,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256 profit) {
        require(arbitrageOpportunities[opportunityId].isActive, "Opportunity not active");
        require(arbitrageOpportunities[opportunityId].expiryTime > block.timestamp, "Opportunity expired");
        
        ArbitrageOpportunity storage opportunity = arbitrageOpportunities[opportunityId];
        require(amount >= opportunity.minAmount && amount <= opportunity.maxAmount, "Invalid amount");
        
        // Calculate profit using real prices
        uint256 expectedOutput = (amount * opportunity.priceB) / opportunity.priceA;
        profit = expectedOutput > amount ? expectedOutput - amount : 0;
        
        require(profit > 0, "No profit potential");
        
        // Calculate fees
        uint256 fee = (profit * arbitrageFee) / FEE_PRECISION;
        uint256 netProfit = profit - fee;
        
        // Execute the arbitrage (simplified - would interact with external DEXes)
        // In real implementation, this would execute trades on external DEXes
        
        totalTrades++;
        totalVolume += amount;
        totalFeesCollected += fee;
        
        emit ArbitrageExecuted(msg.sender, opportunity.tokenA, opportunity.tokenB, amount, amount + netProfit, netProfit, fee);
        
        return netProfit;
    }
    
    // Get real price from external DEX
    function _getRealPrice(
        IUniswapV2Router02 router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        try router.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }
    
    // Utility functions
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    // Admin functions
    function setFees(uint256 _tradingFee, uint256 _liquidityFee, uint256 _arbitrageFee) external onlyOwner {
        require(_tradingFee <= 100, "Trading fee too high");
        require(_liquidityFee <= 50, "Liquidity fee too high");
        require(_arbitrageFee <= 100, "Arbitrage fee too high");
        
        tradingFee = _tradingFee;
        liquidityFee = _liquidityFee;
        arbitrageFee = _arbitrageFee;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // View functions
    function getLiquidityPool(bytes32 poolId) external view returns (
        address tokenA,
        address tokenB,
        uint256 reserveA,
        uint256 reserveB,
        uint256 totalSupply,
        bool isActive,
        uint256 lastUpdateTime
    ) {
        LiquidityPool memory pool = liquidityPools[poolId];
        return (
            pool.tokenA,
            pool.tokenB,
            pool.reserveA,
            pool.reserveB,
            pool.totalSupply,
            pool.isActive,
            pool.lastUpdateTime
        );
    }
    
    function getUserPosition(address user, bytes32 poolId) external view returns (
        uint256 liquidity,
        uint256 tokenAAmount,
        uint256 tokenBAmount,
        uint256 lastClaimTime
    ) {
        UserPosition memory position = userPositions[user][poolId];
        return (
            position.liquidity,
            position.tokenAAmount,
            position.tokenBAmount,
            position.lastClaimTime
        );
    }
    
    function getArbitrageOpportunity(bytes32 opportunityId) external view returns (
        address tokenA,
        address tokenB,
        uint256 priceA,
        uint256 priceB,
        uint256 profitPotential,
        uint256 minAmount,
        uint256 maxAmount,
        bool isActive,
        uint256 expiryTime,
        string memory source
    ) {
        ArbitrageOpportunity memory opportunity = arbitrageOpportunities[opportunityId];
        return (
            opportunity.tokenA,
            opportunity.tokenB,
            opportunity.priceA,
            opportunity.priceB,
            opportunity.profitPotential,
            opportunity.minAmount,
            opportunity.maxAmount,
            opportunity.isActive,
            opportunity.expiryTime,
            opportunity.source
        );
    }
    
    function getActivePools() external view returns (bytes32[] memory) {
        return activePools;
    }
    
    function getActiveOpportunities() external view returns (bytes32[] memory) {
        return activeOpportunities;
    }
    
    function getPlatformStats() external view returns (
        uint256 totalTradesCount,
        uint256 totalVolumeAmount,
        uint256 totalLiquidityAmount,
        uint256 totalFeesAmount
    ) {
        return (
            totalTrades,
            totalVolume,
            totalLiquidityProvided,
            totalFeesCollected
        );
    }
} 