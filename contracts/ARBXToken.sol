// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ARBXToken is ERC20, ERC20Burnable, Ownable, Pausable, ReentrancyGuard {
    // Token details
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_CIRCULATING = 100_000_000 * 10**18; // 100 million tokens
    
    // Staking variables
    mapping(address => uint256) public stakedAmount;
    mapping(address => uint256) public stakingStartTime;
    mapping(address => uint256) public lastRewardClaim;
    
    uint256 public totalStaked;
    uint256 public stakingRewardRate = 8; // 8% APY
    uint256 public constant REWARD_PRECISION = 10000;
    
    // Fee sharing
    uint256 public totalFeesCollected;
    mapping(address => uint256) public userFeesEarned;
    uint256 public feeSharingPercentage = 50; // 50% of fees to stakers
    uint256 public tokenBurningPercentage = 10; // 10% of fees burned
    
    // Governance
    mapping(address => bool) public isGovernanceMember;
    uint256 public governanceThreshold = 1000 * 10**18; // 1000 tokens to vote
    
    // Events
    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event FeesDistributed(uint256 totalAmount);
    event TokensBurned(uint256 amount);
    event GovernanceMemberAdded(address indexed member);
    event GovernanceMemberRemoved(address indexed member);
    
    constructor() ERC20("ArbitrageX Token", "ARBX") {
        _mint(msg.sender, INITIAL_CIRCULATING);
        isGovernanceMember[msg.sender] = true;
    }
    
    // Staking functions
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Claim existing rewards first
        _claimRewards(msg.sender);
        
        _transfer(msg.sender, address(this), amount);
        stakedAmount[msg.sender] += amount;
        stakingStartTime[msg.sender] = block.timestamp;
        totalStaked += amount;
        
        emit TokensStaked(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(stakedAmount[msg.sender] >= amount, "Insufficient staked amount");
        
        // Claim existing rewards first
        _claimRewards(msg.sender);
        
        stakedAmount[msg.sender] -= amount;
        totalStaked -= amount;
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    function claimRewards() external nonReentrant whenNotPaused {
        _claimRewards(msg.sender);
    }
    
    function _claimRewards(address user) internal {
        uint256 rewards = calculateRewards(user);
        if (rewards > 0) {
            userFeesEarned[user] += rewards;
            _mint(user, rewards);
            lastRewardClaim[user] = block.timestamp;
            emit RewardsClaimed(user, rewards);
        }
    }
    
    function calculateRewards(address user) public view returns (uint256) {
        if (stakedAmount[user] == 0) return 0;
        
        uint256 timeStaked = block.timestamp - stakingStartTime[user];
        uint256 annualReward = (stakedAmount[user] * stakingRewardRate) / 100;
        uint256 reward = (annualReward * timeStaked) / 365 days;
        
        return reward;
    }
    
    // Fee distribution
    function distributeFees() external onlyOwner {
        require(totalStaked > 0, "No tokens staked");
        
        uint256 totalFees = address(this).balance;
        require(totalFees > 0, "No fees to distribute");
        
        // Calculate fee sharing amount
        uint256 feeSharingAmount = (totalFees * feeSharingPercentage) / 100;
        
        // Calculate burn amount
        uint256 burnAmount = (totalFees * tokenBurningPercentage) / 100;
        
        // Burn tokens
        if (burnAmount > 0) {
            _burn(address(this), burnAmount);
            emit TokensBurned(burnAmount);
        }
        
        totalFeesCollected += totalFees;
        emit FeesDistributed(totalFees);
    }
    
    // Governance functions
    function addGovernanceMember(address member) external onlyOwner {
        require(balanceOf(member) >= governanceThreshold, "Insufficient tokens for governance");
        isGovernanceMember[member] = true;
        emit GovernanceMemberAdded(member);
    }
    
    function removeGovernanceMember(address member) external onlyOwner {
        isGovernanceMember[member] = false;
        emit GovernanceMemberRemoved(member);
    }
    
    // Admin functions
    function setStakingRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 20, "Rate too high"); // Max 20% APY
        stakingRewardRate = newRate;
    }
    
    function setFeeSharingPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 100, "Percentage too high");
        feeSharingPercentage = newPercentage;
    }
    
    function setTokenBurningPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 50, "Percentage too high");
        tokenBurningPercentage = newPercentage;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // View functions
    function getStakingInfo(address user) external view returns (
        uint256 staked,
        uint256 rewards,
        uint256 startTime,
        uint256 lastClaim
    ) {
        return (
            stakedAmount[user],
            calculateRewards(user),
            stakingStartTime[user],
            lastRewardClaim[user]
        );
    }
    
    function getPlatformStats() external view returns (
        uint256 totalStakedTokens,
        uint256 totalFees,
        uint256 circulatingSupply
    ) {
        return (
            totalStaked,
            totalFeesCollected,
            totalSupply()
        );
    }
    
    // Override transfer functions to handle staking
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        require(!paused(), "Token transfer paused");
    }
} 