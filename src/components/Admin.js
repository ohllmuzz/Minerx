import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import RealDataService from '../services/RealDataService';

const Admin = () => {
  const { contracts, isConnected, account, provider } = useWeb3();
  const [platformStats, setPlatformStats] = useState({});
  const [liquidityPools, setLiquidityPools] = useState([]);
  const [arbitrageOpportunities, setArbitrageOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realDataService, setRealDataService] = useState(null);
  
  // Form states
  const [newPoolTokenA, setNewPoolTokenA] = useState('');
  const [newPoolTokenB, setNewPoolTokenB] = useState('');
  const [newOpportunityTokenA, setNewOpportunityTokenA] = useState('');
  const [newOpportunityTokenB, setNewOpportunityTokenB] = useState('');
  const [newOpportunityMinAmount, setNewOpportunityMinAmount] = useState('');
  const [newOpportunityMaxAmount, setNewOpportunityMaxAmount] = useState('');
  const [newOpportunityDuration, setNewOpportunityDuration] = useState('');
  const [tradingFee, setTradingFee] = useState('');
  const [liquidityFee, setLiquidityFee] = useState('');
  const [arbitrageFee, setArbitrageFee] = useState('');

  useEffect(() => {
    if (isConnected && contracts.hybridDEX && provider) {
      const dataService = new RealDataService(provider, contracts);
      setRealDataService(dataService);
      loadAdminData();
    }
  }, [isConnected, contracts, provider]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      if (!realDataService) return;

      // Load platform statistics
      const stats = await realDataService.getPlatformStats();
      setPlatformStats(stats);

      // Load liquidity pools
      const pools = await realDataService.getLiquidityPools();
      setLiquidityPools(pools);

      // Load arbitrage opportunities
      const opportunities = await realDataService.getArbitrageOpportunities();
      setArbitrageOpportunities(opportunities);

    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const createLiquidityPool = async () => {
    try {
      if (!contracts.hybridDEX) {
        toast.error('Hybrid DEX contract not available');
        return;
      }

      const tx = await contracts.hybridDEX.createLiquidityPool(newPoolTokenA, newPoolTokenB);
      toast.info('Creating liquidity pool... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Liquidity pool created successfully!');
      setNewPoolTokenA('');
      setNewPoolTokenB('');
      loadAdminData();
      
    } catch (error) {
      console.error('Error creating liquidity pool:', error);
      toast.error('Failed to create liquidity pool');
    }
  };

  const createArbitrageOpportunity = async () => {
    try {
      if (!contracts.hybridDEX) {
        toast.error('Hybrid DEX contract not available');
        return;
      }

      const tx = await contracts.hybridDEX.createArbitrageOpportunity(
        newOpportunityTokenA,
        newOpportunityTokenB,
        ethers.utils.parseEther(newOpportunityMinAmount),
        ethers.utils.parseEther(newOpportunityMaxAmount),
        parseInt(newOpportunityDuration)
      );
      
      toast.info('Creating arbitrage opportunity... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Arbitrage opportunity created successfully!');
      setNewOpportunityTokenA('');
      setNewOpportunityTokenB('');
      setNewOpportunityMinAmount('');
      setNewOpportunityMaxAmount('');
      setNewOpportunityDuration('');
      loadAdminData();
      
    } catch (error) {
      console.error('Error creating arbitrage opportunity:', error);
      toast.error('Failed to create arbitrage opportunity');
    }
  };

  const updateFees = async () => {
    try {
      if (!contracts.hybridDEX) {
        toast.error('Hybrid DEX contract not available');
        return;
      }

      const tx = await contracts.hybridDEX.setFees(
        parseInt(tradingFee),
        parseInt(liquidityFee),
        parseInt(arbitrageFee)
      );
      
      toast.info('Updating fees... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Fees updated successfully!');
      setTradingFee('');
      setLiquidityFee('');
      setArbitrageFee('');
      loadAdminData();
      
    } catch (error) {
      console.error('Error updating fees:', error);
      toast.error('Failed to update fees');
    }
  };

  const pausePlatform = async () => {
    try {
      if (!contracts.hybridDEX) {
        toast.error('Hybrid DEX contract not available');
        return;
      }

      const tx = await contracts.hybridDEX.pause();
      toast.info('Pausing platform... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Platform paused successfully!');
      loadAdminData();
      
    } catch (error) {
      console.error('Error pausing platform:', error);
      toast.error('Failed to pause platform');
    }
  };

  const unpausePlatform = async () => {
    try {
      if (!contracts.hybridDEX) {
        toast.error('Hybrid DEX contract not available');
        return;
      }

      const tx = await contracts.hybridDEX.unpause();
      toast.info('Unpausing platform... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Platform unpaused successfully!');
      loadAdminData();
      
    } catch (error) {
      console.error('Error unpausing platform:', error);
      toast.error('Failed to unpause platform');
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
    return tokenMap[address] || address.slice(0, 6) + '...';
  };

  if (!isConnected) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <h3>Please connect your wallet to access admin panel</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2>Admin Panel</h2>
          <p className="text-muted">Platform management and configuration</p>
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
                  <h3 className="text-success">${platformStats.totalVolume?.toFixed(2) || '0'}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Liquidity</h5>
                  <h3 className="text-warning">${platformStats.totalLiquidity?.toFixed(2) || '0'}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title">Total Fees</h5>
                  <h3 className="text-info">${platformStats.totalFees?.toFixed(2) || '0'}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Management */}
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Platform Control</h5>
                </div>
                <div className="card-body">
                  <div className="d-grid gap-2">
                    <button className="btn btn-warning" onClick={pausePlatform}>
                      Pause Platform
                    </button>
                    <button className="btn btn-success" onClick={unpausePlatform}>
                      Unpause Platform
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Fee Configuration</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Trading Fee (basis points)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={tradingFee}
                      onChange={(e) => setTradingFee(e.target.value)}
                      placeholder="15"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Liquidity Fee (basis points)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={liquidityFee}
                      onChange={(e) => setLiquidityFee(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Arbitrage Fee (basis points)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={arbitrageFee}
                      onChange={(e) => setArbitrageFee(e.target.value)}
                      placeholder="25"
                    />
                  </div>
                  <button className="btn btn-primary w-100" onClick={updateFees}>
                    Update Fees
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Create Liquidity Pool */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Create Liquidity Pool</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-5">
                      <div className="mb-3">
                        <label className="form-label">Token A Address</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newPoolTokenA}
                          onChange={(e) => setNewPoolTokenA(e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                    <div className="col-md-5">
                      <div className="mb-3">
                        <label className="form-label">Token B Address</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newPoolTokenB}
                          onChange={(e) => setNewPoolTokenB(e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="mb-3">
                        <label className="form-label">&nbsp;</label>
                        <button className="btn btn-primary w-100" onClick={createLiquidityPool}>
                          Create Pool
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create Arbitrage Opportunity */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Create Arbitrage Opportunity</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3">
                      <div className="mb-3">
                        <label className="form-label">Token A Address</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newOpportunityTokenA}
                          onChange={(e) => setNewOpportunityTokenA(e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="mb-3">
                        <label className="form-label">Token B Address</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newOpportunityTokenB}
                          onChange={(e) => setNewOpportunityTokenB(e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="mb-3">
                        <label className="form-label">Min Amount</label>
                        <input
                          type="number"
                          className="form-control"
                          value={newOpportunityMinAmount}
                          onChange={(e) => setNewOpportunityMinAmount(e.target.value)}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="mb-3">
                        <label className="form-label">Max Amount</label>
                        <input
                          type="number"
                          className="form-control"
                          value={newOpportunityMaxAmount}
                          onChange={(e) => setNewOpportunityMaxAmount(e.target.value)}
                          placeholder="10000"
                        />
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="mb-3">
                        <label className="form-label">Duration (seconds)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={newOpportunityDuration}
                          onChange={(e) => setNewOpportunityDuration(e.target.value)}
                          placeholder="3600"
                        />
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-success" onClick={createArbitrageOpportunity}>
                    Create Opportunity
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Liquidity Pools */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Active Liquidity Pools</h5>
                </div>
                <div className="card-body">
                  {liquidityPools.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Pool</th>
                            <th>Reserve A</th>
                            <th>Reserve B</th>
                            <th>Total Supply</th>
                            <th>Last Update</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidityPools.map((pool, index) => (
                            <tr key={index}>
                              <td>
                                <strong>
                                  {getTokenSymbol(pool.tokenA)} / {getTokenSymbol(pool.tokenB)}
                                </strong>
                              </td>
                              <td>{pool.reserveA.toFixed(4)} {getTokenSymbol(pool.tokenA)}</td>
                              <td>{pool.reserveB.toFixed(4)} {getTokenSymbol(pool.tokenB)}</td>
                              <td>{pool.totalSupply.toFixed(4)}</td>
                              <td>{pool.lastUpdateTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No active liquidity pools</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Arbitrage Opportunities */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Active Arbitrage Opportunities</h5>
                </div>
                <div className="card-body">
                  {arbitrageOpportunities.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Token Pair</th>
                            <th>Price A</th>
                            <th>Price B</th>
                            <th>Profit Potential</th>
                            <th>Min Amount</th>
                            <th>Max Amount</th>
                            <th>Expiry</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {arbitrageOpportunities.map((opp, index) => (
                            <tr key={index}>
                              <td>
                                <strong>
                                  {getTokenSymbol(opp.tokenA)} / {getTokenSymbol(opp.tokenB)}
                                </strong>
                              </td>
                              <td>${opp.priceA.toFixed(4)}</td>
                              <td>${opp.priceB.toFixed(4)}</td>
                              <td>
                                <span className="badge bg-success">
                                  {opp.profitPotential}%
                                </span>
                              </td>
                              <td>{opp.minAmount.toFixed(4)}</td>
                              <td>{opp.maxAmount.toFixed(4)}</td>
                              <td>{opp.expiryTime}</td>
                              <td>
                                <span className="badge bg-info">{opp.source}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No active arbitrage opportunities</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="row">
            <div className="col-12 text-center">
              <button
                className="btn btn-outline-primary"
                onClick={loadAdminData}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Admin; 