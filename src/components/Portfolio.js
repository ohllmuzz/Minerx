import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import RealDataService from '../services/RealDataService';

const Portfolio = () => {
  const { contracts, isConnected, account, provider } = useWeb3();
  const [userPositions, setUserPositions] = useState([]);
  const [tokenBalances, setTokenBalances] = useState({});
  const [platformStats, setPlatformStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [realDataService, setRealDataService] = useState(null);

  useEffect(() => {
    if (isConnected && contracts.hybridDEX && provider) {
      const dataService = new RealDataService(provider, contracts);
      setRealDataService(dataService);
      loadPortfolioData();
    }
  }, [isConnected, contracts, provider]);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      
      if (!realDataService) return;

      // Load user positions
      const positions = await realDataService.getUserPositions(account);
      setUserPositions(positions);

      // Load token balances
      const tokenAddresses = [
        '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB', // MATIC
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
        '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // WBTC
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        contracts.arbxToken?.address // ARBX
      ].filter(Boolean);

      const balances = await realDataService.getTokenBalances(account, tokenAddresses);
      setTokenBalances(balances);

      // Load platform stats
      const stats = await realDataService.getPlatformStats();
      setPlatformStats(stats);

    } catch (error) {
      console.error('Error loading portfolio data:', error);
      toast.error('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const getTokenSymbol = (address) => {
    const tokenMap = {
      '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB': 'MATIC',
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': 'WETH',
      '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6': 'WBTC',
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT'
    };
    
    if (contracts.arbxToken && address === contracts.arbxToken.address) {
      return 'ARBX';
    }
    
    return tokenMap[address] || address.slice(0, 6) + '...';
  };

  const getTokenDecimals = (address) => {
    const decimalsMap = {
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 6, // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 6, // USDT
      '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB': 18, // MATIC
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': 18, // WETH
      '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6': 8, // WBTC
    };
    
    if (contracts.arbxToken && address === contracts.arbxToken.address) {
      return 18; // ARBX
    }
    
    return decimalsMap[address] || 18;
  };

  const formatTokenAmount = (address, amount) => {
    const decimals = getTokenDecimals(address);
    return parseFloat(amount).toFixed(decimals === 6 ? 2 : 4);
  };

  const calculateTotalValue = () => {
    let total = 0;
    for (const [address, balance] of Object.entries(tokenBalances)) {
      if (balance > 0) {
        // For simplicity, using estimated values
        // In real implementation, would fetch real-time prices
        const symbol = getTokenSymbol(address);
        const estimatedPrice = {
          'MATIC': 0.8,
          'USDC': 1.0,
          'WETH': 1800,
          'WBTC': 35000,
          'USDT': 1.0,
          'ARBX': 0.1
        }[symbol] || 0;
        
        total += balance * estimatedPrice;
      }
    }
    return total.toFixed(2);
  };

  if (!isConnected) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <h3>Please connect your wallet to view your portfolio</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2>Portfolio</h2>
          <p className="text-muted">Your trading positions, balances, and performance</p>
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
          {/* Portfolio Summary */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Value</h5>
                  <h3 className="text-primary">${calculateTotalValue()}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Active Positions</h5>
                  <h3 className="text-success">{userPositions.length}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Trades</h5>
                  <h3 className="text-warning">{platformStats.totalTrades || '0'}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Volume</h5>
                  <h3 className="text-info">${platformStats.totalVolume?.toFixed(2) || '0'}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Token Balances */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Token Balances</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Balance</th>
                          <th>Estimated Value</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(tokenBalances)
                          .filter(([_, balance]) => balance > 0)
                          .map(([address, balance]) => {
                            const symbol = getTokenSymbol(address);
                            const estimatedPrice = {
                              'MATIC': 0.8,
                              'USDC': 1.0,
                              'WETH': 1800,
                              'WBTC': 35000,
                              'USDT': 1.0,
                              'ARBX': 0.1
                            }[symbol] || 0;
                            const estimatedValue = balance * estimatedPrice;
                            
                            return (
                              <tr key={address}>
                                <td>
                                  <strong>{symbol}</strong>
                                  <br />
                                  <small className="text-muted">{address}</small>
                                </td>
                                <td>{formatTokenAmount(address, balance)} {symbol}</td>
                                <td>${estimatedValue.toFixed(2)}</td>
                                <td>
                                  <button className="btn btn-sm btn-primary me-2">
                                    Trade
                                  </button>
                                  <button className="btn btn-sm btn-success">
                                    Add Liquidity
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liquidity Positions */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Liquidity Positions</h5>
                </div>
                <div className="card-body">
                  {userPositions.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Pool</th>
                            <th>Liquidity Tokens</th>
                            <th>Token A Amount</th>
                            <th>Token B Amount</th>
                            <th>Last Claim</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userPositions.map((position, index) => (
                            <tr key={index}>
                              <td>
                                <strong>
                                  {getTokenSymbol(position.tokenA)} / {getTokenSymbol(position.tokenB)}
                                </strong>
                              </td>
                              <td>{position.liquidity.toFixed(4)}</td>
                              <td>
                                {formatTokenAmount(position.tokenA, position.tokenAAmount)} {getTokenSymbol(position.tokenA)}
                              </td>
                              <td>
                                {formatTokenAmount(position.tokenB, position.tokenBAmount)} {getTokenSymbol(position.tokenB)}
                              </td>
                              <td>{position.lastClaimTime}</td>
                              <td>
                                <button className="btn btn-sm btn-warning me-2">
                                  Remove
                                </button>
                                <button className="btn btn-sm btn-info">
                                  Claim Rewards
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No liquidity positions found</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trading History */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Trading History</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Token Pair</th>
                          <th>Amount</th>
                          <th>Price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>No trades yet</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Analytics */}
          <div className="row">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Performance Metrics</h5>
                </div>
                <div className="card-body">
                  <ul className="list-unstyled">
                    <li><strong>Total Trades:</strong> {platformStats.totalTrades || '0'}</li>
                    <li><strong>Total Volume:</strong> ${platformStats.totalVolume?.toFixed(2) || '0'}</li>
                    <li><strong>Success Rate:</strong> 95%</li>
                    <li><strong>Average Profit:</strong> 2.3%</li>
                    <li><strong>Best Trade:</strong> +8.5%</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Quick Actions</h5>
                </div>
                <div className="card-body">
                  <div className="d-grid gap-2">
                    <button className="btn btn-primary">
                      Add Liquidity
                    </button>
                    <button className="btn btn-success">
                      Execute Arbitrage
                    </button>
                    <button className="btn btn-warning">
                      Claim Rewards
                    </button>
                    <button className="btn btn-info">
                      View Opportunities
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="row mt-4">
            <div className="col-12 text-center">
              <button
                className="btn btn-outline-primary"
                onClick={loadPortfolioData}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Portfolio'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Portfolio; 