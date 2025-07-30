// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ARBXToken.sol";

contract ArbitrageXExchange is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    // Token contracts
    ARBXToken public arbxToken;
    
    // Fee structure
    uint256 public arbitrageFee = 25; // 0.25% (basis points)
    uint256 public tradingFee = 10; // 0.1% (basis points)
    uint256 public withdrawalFee = 50; // 0.5% (basis points)
    uint256 public constant FEE_PRECISION = 10000;
    
    // User management
    struct User {
        bool isRegistered;
        uint256 totalTrades;
        uint256 totalVolume;
        uint256 totalProfits;
        uint256 lastTradeTime;
        uint256 tier; // 0: Basic, 1: Premium, 2: VIP
    }
    
    mapping(address => User) public users;
    mapping(address => uint256) public userBalances;
    mapping(address => mapping(address => uint256)) public tokenBalances; // user => token => balance
    
    // Arbitrage opportunities
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
    }
    
    mapping(bytes32 => ArbitrageOpportunity) public arbitrageOpportunities;
    bytes32[] public activeOpportunities;
    
    // Statistics
    uint256 public totalTrades;
    uint256 public totalVolume;
    uint256 public totalProfits;
    uint256 public totalFeesCollected;
    
    // Events
    event UserRegistered(address indexed user);
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
        uint256 profitPotential
    );
    event FeesCollected(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, address token, uint256 amount);
    event Deposit(address indexed user, address token, uint256 amount);
    
    constructor(address _arbxToken) {
        arbxToken = ARBXToken(_arbxToken);
    }
    
    // User registration
    function registerUser() external {
        require(!users[msg.sender].isRegistered, "User already registered");
        
        users[msg.sender] = User({
            isRegistered: true,
            totalTrades: 0,
            totalVolume: 0,
            totalProfits: 0,
            lastTradeTime: 0,
            tier: 0
        });
        
        emit UserRegistered(msg.sender);
    }
    
    // Deposit funds
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(users[msg.sender].isRegistered, "User not registered");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[msg.sender][token] += amount;
        
        emit Deposit(msg.sender, token, amount);
    }
    
    // Withdraw funds
    function withdraw(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(users[msg.sender].isRegistered, "User not registered");
        require(amount > 0, "Amount must be greater than 0");
        require(tokenBalances[msg.sender][token] >= amount, "Insufficient balance");
        
        uint256 fee = (amount * withdrawalFee) / FEE_PRECISION;
        uint256 netAmount = amount - fee;
        
        tokenBalances[msg.sender][token] -= amount;
        totalFeesCollected += fee;
        
        IERC20(token).safeTransfer(msg.sender, netAmount);
        
        emit Withdrawal(msg.sender, token, netAmount);
        emit FeesCollected(msg.sender, fee);
    }
    
    // Execute arbitrage
    function executeArbitrage(
        bytes32 opportunityId,
        uint256 amount,
        address tokenA,
        address tokenB
    ) external nonReentrant whenNotPaused {
        require(users[msg.sender].isRegistered, "User not registered");
        require(arbitrageOpportunities[opportunityId].isActive, "Opportunity not active");
        require(arbitrageOpportunities[opportunityId].expiryTime > block.timestamp, "Opportunity expired");
        require(tokenBalances[msg.sender][tokenA] >= amount, "Insufficient balance");
        
        ArbitrageOpportunity storage opportunity = arbitrageOpportunities[opportunityId];
        require(opportunity.tokenA == tokenA && opportunity.tokenB == tokenB, "Invalid tokens");
        require(amount >= opportunity.minAmount && amount <= opportunity.maxAmount, "Invalid amount");
        
        // Calculate arbitrage profit
        uint256 expectedOutput = (amount * opportunity.priceB) / opportunity.priceA;
        uint256 profit = expectedOutput > amount ? expectedOutput - amount : 0;
        
        require(profit > 0, "No profit potential");
        
        // Calculate fees
        uint256 arbitrageFeeAmount = (profit * arbitrageFee) / FEE_PRECISION;
        uint256 tradingFeeAmount = (amount * tradingFee) / FEE_PRECISION;
        uint256 totalFees = arbitrageFeeAmount + tradingFeeAmount;
        
        uint256 netProfit = profit - totalFees;
        
        // Execute the arbitrage (simplified - in real implementation would interact with DEXes)
        tokenBalances[msg.sender][tokenA] -= amount;
        tokenBalances[msg.sender][tokenB] += (amount + netProfit);
        
        // Update statistics
        users[msg.sender].totalTrades++;
        users[msg.sender].totalVolume += amount;
        users[msg.sender].totalProfits += netProfit;
        users[msg.sender].lastTradeTime = block.timestamp;
        
        totalTrades++;
        totalVolume += amount;
        totalProfits += netProfit;
        totalFeesCollected += totalFees;
        
        // Update user tier based on volume
        _updateUserTier(msg.sender);
        
        emit ArbitrageExecuted(msg.sender, tokenA, tokenB, amount, amount + netProfit, netProfit, totalFees);
    }
    
    // Create arbitrage opportunity (admin only)
    function createArbitrageOpportunity(
        address tokenA,
        address tokenB,
        uint256 priceA,
        uint256 priceB,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 duration
    ) external onlyOwner {
        require(tokenA != tokenB, "Tokens must be different");
        require(priceA > 0 && priceB > 0, "Invalid prices");
        require(minAmount > 0 && maxAmount > minAmount, "Invalid amounts");
        require(duration > 0, "Invalid duration");
        
        bytes32 opportunityId = keccak256(abi.encodePacked(tokenA, tokenB, block.timestamp));
        
        uint256 profitPotential = priceB > priceA ? 
            ((priceB - priceA) * 10000) / priceA : 0;
        
        arbitrageOpportunities[opportunityId] = ArbitrageOpportunity({
            tokenA: tokenA,
            tokenB: tokenB,
            priceA: priceA,
            priceB: priceB,
            profitPotential: profitPotential,
            minAmount: minAmount,
            maxAmount: maxAmount,
            isActive: true,
            expiryTime: block.timestamp + duration
        });
        
        activeOpportunities.push(opportunityId);
        
        emit OpportunityCreated(opportunityId, tokenA, tokenB, profitPotential);
    }
    
    // Update user tier
    function _updateUserTier(address user) internal {
        User storage userData = users[user];
        
        if (userData.totalVolume >= 1000000 * 10**18) { // 1M tokens
            userData.tier = 2; // VIP
        } else if (userData.totalVolume >= 100000 * 10**18) { // 100K tokens
            userData.tier = 1; // Premium
        } else {
            userData.tier = 0; // Basic
        }
    }
    
    // Admin functions
    function setFees(uint256 _arbitrageFee, uint256 _tradingFee, uint256 _withdrawalFee) external onlyOwner {
        require(_arbitrageFee <= 100, "Arbitrage fee too high"); // Max 1%
        require(_tradingFee <= 50, "Trading fee too high"); // Max 0.5%
        require(_withdrawalFee <= 100, "Withdrawal fee too high"); // Max 1%
        
        arbitrageFee = _arbitrageFee;
        tradingFee = _tradingFee;
        withdrawalFee = _withdrawalFee;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawFees(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        
        IERC20(token).safeTransfer(owner(), balance);
    }
    
    // View functions
    function getUserInfo(address user) external view returns (
        bool isRegistered,
        uint256 totalTrades,
        uint256 totalVolume,
        uint256 totalProfits,
        uint256 lastTradeTime,
        uint256 tier
    ) {
        User memory userData = users[user];
        return (
            userData.isRegistered,
            userData.totalTrades,
            userData.totalVolume,
            userData.totalProfits,
            userData.lastTradeTime,
            userData.tier
        );
    }
    
    function getTokenBalance(address user, address token) external view returns (uint256) {
        return tokenBalances[user][token];
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
        uint256 expiryTime
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
            opportunity.expiryTime
        );
    }
    
    function getActiveOpportunities() external view returns (bytes32[] memory) {
        return activeOpportunities;
    }
    
    function getPlatformStats() external view returns (
        uint256 totalTradesCount,
        uint256 totalVolumeAmount,
        uint256 totalProfitsAmount,
        uint256 totalFeesAmount
    ) {
        return (
            totalTrades,
            totalVolume,
            totalProfits,
            totalFeesCollected
        );
    }
} 