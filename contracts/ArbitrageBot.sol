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
import "./ArbitrageXExchange.sol";

contract ArbitrageBot is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    // DEX interfaces
    IUniswapV2Router02 public quickswapRouter;
    IUniswapV2Router02 public sushiswapRouter;
    IUniswapV2Factory public quickswapFactory;
    IUniswapV2Factory public sushiswapFactory;
    
    // Exchange contract
    ArbitrageXExchange public exchange;
    
    // Bot configuration
    uint256 public minProfitThreshold = 100; // 1% minimum profit
    uint256 public maxSlippage = 50; // 0.5% max slippage
    uint256 public gasPriceLimit = 50 * 10**9; // 50 gwei
    uint256 public constant PRECISION = 10000;
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;
    
    // Arbitrage history
    struct ArbitrageExecution {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        uint256 amountOut;
        uint256 profit;
        uint256 gasUsed;
        uint256 timestamp;
        bool success;
    }
    
    mapping(uint256 => ArbitrageExecution) public arbitrageHistory;
    uint256 public totalExecutions;
    uint256 public successfulExecutions;
    uint256 public totalProfit;
    
    // Events
    event ArbitrageOpportunityFound(
        address tokenA,
        address tokenB,
        uint256 priceA,
        uint256 priceB,
        uint256 profitPotential
    );
    event ArbitrageExecuted(
        uint256 executionId,
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        bool success
    );
    event TokenAdded(address token);
    event TokenRemoved(address token);
    event ConfigurationUpdated(uint256 minProfit, uint256 maxSlippage, uint256 gasLimit);
    
    constructor(
        address _quickswapRouter,
        address _sushiswapRouter,
        address _exchange
    ) {
        quickswapRouter = IUniswapV2Router02(_quickswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
        quickswapFactory = IUniswapV2Factory(quickswapRouter.factory());
        sushiswapFactory = IUniswapV2Factory(sushiswapRouter.factory());
        exchange = ArbitrageXExchange(_exchange);
        
        // Add common tokens
        _addSupportedToken(0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB); // MATIC
        _addSupportedToken(0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6); // WBTC
        _addSupportedToken(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619); // WETH
        _addSupportedToken(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174); // USDC
        _addSupportedToken(0xc2132D05D31c914a87C6611C10748AEb04B58e8F); // USDT
    }
    
    // Add supported token
    function addSupportedToken(address token) external onlyOwner {
        _addSupportedToken(token);
    }
    
    function _addSupportedToken(address token) internal {
        require(!supportedTokens[token], "Token already supported");
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }
    
    // Remove supported token
    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        supportedTokens[token] = false;
        
        // Remove from tokenList
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    // Scan for arbitrage opportunities
    function scanArbitrageOpportunities() external view returns (
        address[] memory tokenPairs,
        uint256[] memory profitPotentials,
        uint256[] memory optimalAmounts
    ) {
        uint256 pairCount = 0;
        
        // Count potential pairs
        for (uint256 i = 0; i < tokenList.length; i++) {
            for (uint256 j = i + 1; j < tokenList.length; j++) {
                if (_hasLiquidity(tokenList[i], tokenList[j])) {
                    pairCount++;
                }
            }
        }
        
        tokenPairs = new address[](pairCount * 2);
        profitPotentials = new uint256[](pairCount);
        optimalAmounts = new uint256[](pairCount);
        
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            for (uint256 j = i + 1; j < tokenList.length; j++) {
                if (_hasLiquidity(tokenList[i], tokenList[j])) {
                    (uint256 profit, uint256 optimalAmount) = _calculateArbitrageOpportunity(
                        tokenList[i],
                        tokenList[j]
                    );
                    
                    if (profit >= minProfitThreshold) {
                        tokenPairs[currentIndex * 2] = tokenList[i];
                        tokenPairs[currentIndex * 2 + 1] = tokenList[j];
                        profitPotentials[currentIndex] = profit;
                        optimalAmounts[currentIndex] = optimalAmount;
                        currentIndex++;
                    }
                }
            }
        }
        
        // Resize arrays to actual count
        assembly {
            mstore(tokenPairs, mul(currentIndex, 2))
            mstore(profitPotentials, currentIndex)
            mstore(optimalAmounts, currentIndex)
        }
    }
    
    // Execute arbitrage
    function executeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (bool success, uint256 profit) {
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported tokens");
        require(amount > 0, "Invalid amount");
        require(tx.gasprice <= gasPriceLimit, "Gas price too high");
        
        uint256 gasStart = gasleft();
        
        // Check if arbitrage opportunity exists
        (uint256 profitPotential, uint256 optimalAmount) = _calculateArbitrageOpportunity(tokenA, tokenB);
        require(profitPotential >= minProfitThreshold, "Insufficient profit potential");
        
        // Use optimal amount if provided amount is too large
        if (amount > optimalAmount) {
            amount = optimalAmount;
        }
        
        // Execute the arbitrage
        try this._executeArbitrageInternal(tokenA, tokenB, amount) returns (uint256 actualProfit) {
            profit = actualProfit;
            success = true;
            successfulExecutions++;
            totalProfit += profit;
        } catch {
            success = false;
            profit = 0;
        }
        
        uint256 gasUsed = gasStart - gasleft();
        
        // Record execution
        arbitrageHistory[totalExecutions] = ArbitrageExecution({
            tokenA: tokenA,
            tokenB: tokenB,
            amountIn: amount,
            amountOut: amount + profit,
            profit: profit,
            gasUsed: gasUsed,
            timestamp: block.timestamp,
            success: success
        });
        
        totalExecutions++;
        
        emit ArbitrageExecuted(totalExecutions - 1, tokenA, tokenB, amount, amount + profit, profit, success);
        
        return (success, profit);
    }
    
    // Internal arbitrage execution
    function _executeArbitrageInternal(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Get initial balance
        uint256 initialBalance = IERC20(tokenB).balanceOf(address(this));
        
        // Approve tokens for routers
        IERC20(tokenA).safeApprove(address(quickswapRouter), amount);
        IERC20(tokenA).safeApprove(address(sushiswapRouter), amount);
        
        // Get prices from both DEXes
        uint256 priceQuick = _getTokenPrice(quickswapRouter, tokenA, tokenB, amount);
        uint256 priceSushi = _getTokenPrice(sushiswapRouter, tokenA, tokenB, amount);
        
        // Determine which DEX to buy from and sell to
        if (priceQuick > priceSushi) {
            // Buy from Sushiswap, sell to Quickswap
            _swapTokens(sushiswapRouter, tokenA, tokenB, amount);
            uint256 receivedAmount = IERC20(tokenB).balanceOf(address(this)) - initialBalance;
            _swapTokens(quickswapRouter, tokenB, tokenA, receivedAmount);
        } else {
            // Buy from Quickswap, sell to Sushiswap
            _swapTokens(quickswapRouter, tokenA, tokenB, amount);
            uint256 receivedAmount = IERC20(tokenB).balanceOf(address(this)) - initialBalance;
            _swapTokens(sushiswapRouter, tokenB, tokenA, receivedAmount);
        }
        
        // Calculate profit
        uint256 finalBalance = IERC20(tokenA).balanceOf(address(this));
        profit = finalBalance > amount ? finalBalance - amount : 0;
        
        // Revoke approvals
        IERC20(tokenA).safeApprove(address(quickswapRouter), 0);
        IERC20(tokenA).safeApprove(address(sushiswapRouter), 0);
        
        return profit;
    }
    
    // Calculate arbitrage opportunity
    function _calculateArbitrageOpportunity(
        address tokenA,
        address tokenB
    ) internal view returns (uint256 profit, uint256 optimalAmount) {
        if (!_hasLiquidity(tokenA, tokenB)) {
            return (0, 0);
        }
        
        // Test with different amounts to find optimal
        uint256[] memory testAmounts = new uint256[](5);
        testAmounts[0] = 1 * 10**18; // 1 token
        testAmounts[1] = 10 * 10**18; // 10 tokens
        testAmounts[2] = 100 * 10**18; // 100 tokens
        testAmounts[3] = 1000 * 10**18; // 1000 tokens
        testAmounts[4] = 10000 * 10**18; // 10000 tokens
        
        uint256 maxProfit = 0;
        uint256 bestAmount = 0;
        
        for (uint256 i = 0; i < testAmounts.length; i++) {
            uint256 testAmount = testAmounts[i];
            
            try this._calculateProfitForAmount(tokenA, tokenB, testAmount) returns (uint256 testProfit) {
                if (testProfit > maxProfit) {
                    maxProfit = testProfit;
                    bestAmount = testAmount;
                }
            } catch {
                // Skip this amount if calculation fails
                continue;
            }
        }
        
        return (maxProfit, bestAmount);
    }
    
    // Calculate profit for specific amount
    function _calculateProfitForAmount(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external view returns (uint256 profit) {
        require(msg.sender == address(this), "Only self-call allowed");
        
        uint256 priceQuick = _getTokenPrice(quickswapRouter, tokenA, tokenB, amount);
        uint256 priceSushi = _getTokenPrice(sushiswapRouter, tokenA, tokenB, amount);
        
        if (priceQuick > priceSushi) {
            // Buy from Sushiswap, sell to Quickswap
            uint256 receivedFromSushi = _getTokenPrice(sushiswapRouter, tokenA, tokenB, amount);
            uint256 receivedFromQuick = _getTokenPrice(quickswapRouter, tokenB, tokenA, receivedFromSushi);
            profit = receivedFromQuick > amount ? receivedFromQuick - amount : 0;
        } else {
            // Buy from Quickswap, sell to Sushiswap
            uint256 receivedFromQuick = _getTokenPrice(quickswapRouter, tokenA, tokenB, amount);
            uint256 receivedFromSushi = _getTokenPrice(sushiswapRouter, tokenB, tokenA, receivedFromQuick);
            profit = receivedFromSushi > amount ? receivedFromSushi - amount : 0;
        }
        
        return profit;
    }
    
    // Get token price from DEX
    function _getTokenPrice(
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
    
    // Execute token swap
    function _swapTokens(
        IUniswapV2Router02 router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256 minAmountOut = (amountIn * (PRECISION - maxSlippage)) / PRECISION;
        
        router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp
        );
    }
    
    // Check if pair has liquidity
    function _hasLiquidity(address tokenA, address tokenB) internal view returns (bool) {
        address pairQuick = quickswapFactory.getPair(tokenA, tokenB);
        address pairSushi = sushiswapFactory.getPair(tokenA, tokenB);
        
        if (pairQuick == address(0) || pairSushi == address(0)) {
            return false;
        }
        
        // Check if pairs have reserves
        (uint112 reserveA1, uint112 reserveB1,) = IUniswapV2Pair(pairQuick).getReserves();
        (uint112 reserveA2, uint112 reserveB2,) = IUniswapV2Pair(pairSushi).getReserves();
        
        return (reserveA1 > 0 && reserveB1 > 0) || (reserveA2 > 0 && reserveB2 > 0);
    }
    
    // Admin functions
    function setConfiguration(
        uint256 _minProfitThreshold,
        uint256 _maxSlippage,
        uint256 _gasPriceLimit
    ) external onlyOwner {
        minProfitThreshold = _minProfitThreshold;
        maxSlippage = _maxSlippage;
        gasPriceLimit = _gasPriceLimit;
        
        emit ConfigurationUpdated(_minProfitThreshold, _maxSlippage, _gasPriceLimit);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    // View functions
    function getArbitrageExecution(uint256 executionId) external view returns (
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed,
        uint256 timestamp,
        bool success
    ) {
        ArbitrageExecution memory execution = arbitrageHistory[executionId];
        return (
            execution.tokenA,
            execution.tokenB,
            execution.amountIn,
            execution.amountOut,
            execution.profit,
            execution.gasUsed,
            execution.timestamp,
            execution.success
        );
    }
    
    function getBotStats() external view returns (
        uint256 totalExecutionsCount,
        uint256 successfulExecutionsCount,
        uint256 totalProfitAmount,
        uint256 successRate
    ) {
        uint256 rate = totalExecutions > 0 ? (successfulExecutions * 10000) / totalExecutions : 0;
        return (
            totalExecutions,
            successfulExecutions,
            totalProfit,
            rate
        );
    }
    
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }
} 