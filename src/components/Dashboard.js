import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const { contracts, isConnected, account } = useWeb3();
  const [platformStats, setPlatformStats] = useState({});
  const [userStats, setUserStats] = useState({});
  const [arbxBalance, setArbxBalance] = useState('0');
  const [recentOpportunities, setRecentOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && contracts.exchange) {
      loadDashboardData();
    }
  }, [isConnected, contracts]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load platform statistics
      const stats = await contracts.exchange.getPlatformStats();
      setPlatformStats({
        totalTrades: ethers.utils.formatEther(stats.totalTradesCount),
        totalVolume: ethers.utils.formatEther(stats.totalVolumeAmount),
        totalProfits: ethers.utils.formatEther(stats.totalProfitsAmount),
        totalFees: ethers.utils.formatEther(stats.totalFeesAmount)
      });

      // Load user statistics
      if (account) {
        const userInfo = await contracts.exchange.getUserInfo(account);
        setUserStats({
          isRegistered: userInfo.isRegistered,
          totalTrades: userInfo.totalTrades.toString(),
          totalVolume: ethers.utils.formatEther(userInfo.totalVolume),
          totalProfits: ethers.utils.formatEther(userInfo.totalProfits),
          tier: userInfo.tier.toString()
        });

        // Load ARBX balance
        const balance = await contracts.arbxToken.balanceOf(account);
        setArbxBalance(ethers.utils.formatEther(balance));
      }

      // Load recent opportunities
      const opportunities = await contracts.exchange.getActiveOpportunities();
      const recentOpps = [];
      
      for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
        const opp = await contracts.exchange.getArbitrageOpportunity(opportunities[i]);
        recentOpps.push({
          id: opportunities[i],
          tokenA: opp.tokenA,
          tokenB: opp.tokenB,
          profitPotential: opp.profitPotential.toString(),
          expiryTime: new Date(opp.expiryTime * 1000).toLocaleString()
        });
      }
      
      setRecentOpportunities(recentOpps);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async () => {
    try {
      const tx = await contracts.exchange.registerUser();
      await tx.wait();
      toast.success('Successfully registered!');
      loadDashboardData();
    } catch (error) {
      console.error('Error registering user:', error);
      toast.error('Failed to register user');
    }
  };

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Trading Volume',
        data: [12, 19, 3, 5, 2, 3],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Profits',
        data: [2, 3, 20, 5, 1, 4],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      }
    ]
  };

  const profitData = {
    labels: ['MATIC/USDC', 'WETH/USDC', 'WBTC/USDC', 'ARBX/MATIC'],
    datasets: [
      {
        label: 'Profit Potential (%)',
        data: [2.5, 1.8, 3.2, 4.1],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ],
      }
    ]
  };

  if (!isConnected) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8 text-center">
            <div className="card">
              <div className="card-body">
                <h2>Welcome to ArbitrageX</h2>
                <p className="lead">Connect your wallet to start trading arbitrage opportunities</p>
                <div className="mt-4">
                  <h4>🚀 Platform Features</h4>
                  <ul className="list-unstyled">
                    <li>✅ Automated arbitrage execution</li>
                    <li>✅ Real-time opportunity monitoring</li>
                    <li>✅ Staking rewards with ARBX tokens</li>
                    <li>✅ Professional risk management</li>
                    <li>✅ Multi-DEX integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Welcome Section */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <h2>Welcome to ArbitrageX Dashboard</h2>
                  <p className="mb-0">
                    {userStats.isRegistered 
                      ? `You have executed ${userStats.totalTrades} trades with ${userStats.totalProfits} MATIC in profits`
                      : 'Register to start trading arbitrage opportunities'
                    }
                  </p>
                  {!userStats.isRegistered && (
                    <button className="btn btn-light mt-2" onClick={registerUser}>
                      Register Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Platform Statistics */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Trades</h5>
                  <h3 className="text-primary">{platformStats.totalTrades || '0'}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Volume</h5>
                  <h3 className="text-success">{platformStats.totalVolume || '0'} MATIC</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Profits</h5>
                  <h3 className="text-warning">{platformStats.totalProfits || '0'} MATIC</h3>
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
          </div>

          {/* Charts */}
          <div className="row mb-4">
            <div className="col-md-8">
              <div className="card">
                <div className="card-header">
                  <h5>Platform Performance</h5>
                </div>
                <div className="card-body">
                  <Line data={chartData} />
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h5>Current Opportunities</h5>
                </div>
                <div className="card-body">
                  <Bar data={profitData} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Opportunities */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Recent Arbitrage Opportunities</h5>
                </div>
                <div className="card-body">
                  {recentOpportunities.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Token Pair</th>
                            <th>Profit Potential</th>
                            <th>Expiry Time</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOpportunities.map((opp, index) => (
                            <tr key={index}>
                              <td>{opp.tokenA.slice(0, 6)}... / {opp.tokenB.slice(0, 6)}...</td>
                              <td>
                                <span className="badge bg-success">
                                  {opp.profitPotential}%
                                </span>
                              </td>
                              <td>{opp.expiryTime}</td>
                              <td>
                                <button className="btn btn-sm btn-primary">
                                  Execute
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No active opportunities at the moment</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 