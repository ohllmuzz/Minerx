import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

const Staking = () => {
  const { contracts, isConnected, account } = useWeb3();
  const [stakingInfo, setStakingInfo] = useState({});
  const [platformStats, setPlatformStats] = useState({});
  const [arbxBalance, setArbxBalance] = useState('0');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (isConnected && contracts.arbxToken) {
      loadStakingData();
    }
  }, [isConnected, contracts]);

  const loadStakingData = async () => {
    try {
      setLoading(true);
      
      if (account) {
        // Load staking info
        const stakingData = await contracts.arbxToken.getStakingInfo(account);
        setStakingInfo({
          staked: ethers.utils.formatEther(stakingData.staked),
          rewards: ethers.utils.formatEther(stakingData.rewards),
          startTime: new Date(stakingData.startTime * 1000).toLocaleString(),
          lastClaim: new Date(stakingData.lastClaim * 1000).toLocaleString()
        });

        // Load ARBX balance
        const balance = await contracts.arbxToken.balanceOf(account);
        setArbxBalance(ethers.utils.formatEther(balance));
      }

      // Load platform stats
      const stats = await contracts.arbxToken.getPlatformStats();
      setPlatformStats({
        totalStaked: ethers.utils.formatEther(stats.totalStakedTokens),
        totalFees: ethers.utils.formatEther(stats.totalFees),
        circulatingSupply: ethers.utils.formatEther(stats.circulatingSupply)
      });

    } catch (error) {
      console.error('Error loading staking data:', error);
      toast.error('Failed to load staking data');
    } finally {
      setLoading(false);
    }
  };

  const stakeTokens = async () => {
    try {
      setStaking(true);
      
      const amount = ethers.utils.parseEther(stakeAmount);
      const tx = await contracts.arbxToken.stake(amount);
      
      toast.info('Staking tokens... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Tokens staked successfully!');
      setStakeAmount('');
      loadStakingData();
      
    } catch (error) {
      console.error('Error staking tokens:', error);
      toast.error('Failed to stake tokens');
    } finally {
      setStaking(false);
    }
  };

  const unstakeTokens = async () => {
    try {
      setUnstaking(true);
      
      const amount = ethers.utils.parseEther(unstakeAmount);
      const tx = await contracts.arbxToken.unstake(amount);
      
      toast.info('Unstaking tokens... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Tokens unstaked successfully!');
      setUnstakeAmount('');
      loadStakingData();
      
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      toast.error('Failed to unstake tokens');
    } finally {
      setUnstaking(false);
    }
  };

  const claimRewards = async () => {
    try {
      setClaiming(true);
      
      const tx = await contracts.arbxToken.claimRewards();
      
      toast.info('Claiming rewards... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Rewards claimed successfully!');
      loadStakingData();
      
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error('Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  };

  const calculateAPY = () => {
    return 8; // 8% APY as defined in the contract
  };

  const calculateRewardsPerDay = () => {
    const staked = parseFloat(stakingInfo.staked || 0);
    const apy = calculateAPY();
    return (staked * apy) / 365;
  };

  if (!isConnected) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <h3>Please connect your wallet to access staking features</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2>ARBX Staking</h2>
          <p className="text-muted">Stake your ARBX tokens to earn rewards and participate in governance</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Staking Statistics */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Your Staked</h5>
                  <h3 className="text-primary">{stakingInfo.staked || '0'} ARBX</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Available Rewards</h5>
                  <h3 className="text-success">{stakingInfo.rewards || '0'} ARBX</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">ARBX Balance</h5>
                  <h3 className="text-info">{arbxBalance} ARBX</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">APY</h5>
                  <h3 className="text-warning">{calculateAPY()}%</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Statistics */}
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h6>Total Staked</h6>
                </div>
                <div className="card-body">
                  <h4>{platformStats.totalStaked || '0'} ARBX</h4>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h6>Total Fees Collected</h6>
                </div>
                <div className="card-body">
                  <h4>{platformStats.totalFees || '0'} MATIC</h4>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h6>Circulating Supply</h6>
                </div>
                <div className="card-body">
                  <h4>{platformStats.circulatingSupply || '0'} ARBX</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Staking Actions */}
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Stake Tokens</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Amount to Stake (ARBX)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="0"
                      step="0.01"
                    />
                    <small className="text-muted">
                      Available: {arbxBalance} ARBX
                    </small>
                  </div>
                  <button
                    className="btn btn-primary w-100"
                    onClick={stakeTokens}
                    disabled={staking || !stakeAmount || parseFloat(stakeAmount) <= 0}
                  >
                    {staking ? 'Staking...' : 'Stake Tokens'}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Unstake Tokens</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Amount to Unstake (ARBX)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="0"
                      max={stakingInfo.staked || 0}
                      step="0.01"
                    />
                    <small className="text-muted">
                      Staked: {stakingInfo.staked || '0'} ARBX
                    </small>
                  </div>
                  <button
                    className="btn btn-warning w-100"
                    onClick={unstakeTokens}
                    disabled={unstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                  >
                    {unstaking ? 'Unstaking...' : 'Unstake Tokens'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Section */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Rewards & Governance</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <h6>Rewards Information</h6>
                      <ul className="list-unstyled">
                        <li>• APY: {calculateAPY()}%</li>
                        <li>• Daily Rewards: {calculateRewardsPerDay().toFixed(4)} ARBX</li>
                        <li>• Staking Start: {stakingInfo.startTime || 'Not staked'}</li>
                        <li>• Last Claim: {stakingInfo.lastClaim || 'Never'}</li>
                      </ul>
                      <button
                        className="btn btn-success"
                        onClick={claimRewards}
                        disabled={claiming || parseFloat(stakingInfo.rewards || 0) <= 0}
                      >
                        {claiming ? 'Claiming...' : 'Claim Rewards'}
                      </button>
                    </div>
                    <div className="col-md-6">
                      <h6>Governance Benefits</h6>
                      <ul className="list-unstyled">
                        <li>• Vote on platform decisions</li>
                        <li>• 50% of platform fees shared</li>
                        <li>• 10% of fees burned (deflationary)</li>
                        <li>• Premium features access</li>
                        <li>• Priority support</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Staking History */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Staking History</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Staking Started</td>
                          <td>{stakingInfo.staked || '0'} ARBX</td>
                          <td>{stakingInfo.startTime || 'N/A'}</td>
                          <td><span className="badge bg-success">Active</span></td>
                        </tr>
                        <tr>
                          <td>Last Reward Claim</td>
                          <td>{stakingInfo.rewards || '0'} ARBX</td>
                          <td>{stakingInfo.lastClaim || 'N/A'}</td>
                          <td><span className="badge bg-info">Pending</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Staking; 