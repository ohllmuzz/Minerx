import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

const ArbitrageOpportunities = () => {
  const { contracts, isConnected, account } = useWeb3();
  const [opportunities, setOpportunities] = useState([]);
  const [botOpportunities, setBotOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (isConnected && contracts.exchange) {
      loadOpportunities();
    }
  }, [isConnected, contracts]);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      
      // Load exchange opportunities
      const exchangeOpps = await contracts.exchange.getActiveOpportunities();
      const oppsData = [];
      
      for (const oppId of exchangeOpps) {
        const opp = await contracts.exchange.getArbitrageOpportunity(oppId);
        oppsData.push({
          id: oppId,
          tokenA: opp.tokenA,
          tokenB: opp.tokenB,
          priceA: ethers.utils.formatEther(opp.priceA),
          priceB: ethers.utils.formatEther(opp.priceB),
          profitPotential: opp.profitPotential.toString(),
          minAmount: ethers.utils.formatEther(opp.minAmount),
          maxAmount: ethers.utils.formatEther(opp.maxAmount),
          isActive: opp.isActive,
          expiryTime: new Date(opp.expiryTime * 1000).toLocaleString()
        });
      }
      
      setOpportunities(oppsData);

      // Load bot opportunities
      if (contracts.bot) {
        const botOpps = await contracts.bot.scanArbitrageOpportunities();
        const botOppsData = [];
        
        for (let i = 0; i < botOpps.tokenPairs.length; i += 2) {
          botOppsData.push({
            tokenA: botOpps.tokenPairs[i],
            tokenB: botOpps.tokenPairs[i + 1],
            profitPotential: botOpps.profitPotentials[i / 2].toString(),
            optimalAmount: ethers.utils.formatEther(botOpps.optimalAmounts[i / 2])
          });
        }
        
        setBotOpportunities(botOppsData);
      }

    } catch (error) {
      console.error('Error loading opportunities:', error);
      toast.error('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  const executeArbitrage = async (opportunityId, tokenA, tokenB, amount) => {
    try {
      setExecuting(true);
      
      const tx = await contracts.exchange.executeArbitrage(
        opportunityId,
        ethers.utils.parseEther(amount),
        tokenA,
        tokenB
      );
      
      toast.info('Executing arbitrage... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Arbitrage executed successfully!');
      loadOpportunities();
      
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      toast.error('Failed to execute arbitrage');
    } finally {
      setExecuting(false);
    }
  };

  const executeBotArbitrage = async (tokenA, tokenB, amount) => {
    try {
      setExecuting(true);
      
      const tx = await contracts.bot.executeArbitrage(
        tokenA,
        tokenB,
        ethers.utils.parseEther(amount)
      );
      
      toast.info('Executing bot arbitrage... Please wait for confirmation');
      await tx.wait();
      
      toast.success('Bot arbitrage executed successfully!');
      loadOpportunities();
      
    } catch (error) {
      console.error('Error executing bot arbitrage:', error);
      toast.error('Failed to execute bot arbitrage');
    } finally {
      setExecuting(false);
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
          <h3>Please connect your wallet to view arbitrage opportunities</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2>Arbitrage Opportunities</h2>
          <p className="text-muted">Discover and execute profitable arbitrage trades across multiple DEXes</p>
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
          {/* Exchange Opportunities */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Exchange Opportunities</h5>
                  <small className="text-muted">Pre-configured arbitrage opportunities</small>
                </div>
                <div className="card-body">
                  {opportunities.length > 0 ? (
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
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opportunities.map((opp, index) => (
                            <tr key={index}>
                              <td>
                                <strong>
                                  {getTokenSymbol(opp.tokenA)} / {getTokenSymbol(opp.tokenB)}
                                </strong>
                              </td>
                              <td>{opp.priceA}</td>
                              <td>{opp.priceB}</td>
                              <td>
                                <span className="badge bg-success">
                                  {opp.profitPotential}%
                                </span>
                              </td>
                              <td>{opp.minAmount}</td>
                              <td>{opp.maxAmount}</td>
                              <td>{opp.expiryTime}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setSelectedOpportunity(opp);
                                    setAmount(opp.minAmount);
                                  }}
                                  disabled={executing}
                                >
                                  Execute
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No exchange opportunities available</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bot Opportunities */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Bot-Detected Opportunities</h5>
                  <small className="text-muted">Real-time arbitrage opportunities from DEX monitoring</small>
                </div>
                <div className="card-body">
                  {botOpportunities.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Token Pair</th>
                            <th>Profit Potential</th>
                            <th>Optimal Amount</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {botOpportunities.map((opp, index) => (
                            <tr key={index}>
                              <td>
                                <strong>
                                  {getTokenSymbol(opp.tokenA)} / {getTokenSymbol(opp.tokenB)}
                                </strong>
                              </td>
                              <td>
                                <span className="badge bg-warning">
                                  {opp.profitPotential}%
                                </span>
                              </td>
                              <td>{opp.optimalAmount}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => executeBotArbitrage(
                                    opp.tokenA,
                                    opp.tokenB,
                                    opp.optimalAmount
                                  )}
                                  disabled={executing}
                                >
                                  Execute Bot
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted">No bot-detected opportunities available</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Execute Modal */}
          {selectedOpportunity && (
            <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Execute Arbitrage</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setSelectedOpportunity(null)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Token Pair</label>
                      <input
                        type="text"
                        className="form-control"
                        value={`${getTokenSymbol(selectedOpportunity.tokenA)} / ${getTokenSymbol(selectedOpportunity.tokenB)}`}
                        readOnly
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Profit Potential</label>
                      <input
                        type="text"
                        className="form-control"
                        value={`${selectedOpportunity.profitPotential}%`}
                        readOnly
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Amount ({getTokenSymbol(selectedOpportunity.tokenA)})</label>
                      <input
                        type="number"
                        className="form-control"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min={selectedOpportunity.minAmount}
                        max={selectedOpportunity.maxAmount}
                        step="0.01"
                      />
                      <small className="text-muted">
                        Min: {selectedOpportunity.minAmount} | Max: {selectedOpportunity.maxAmount}
                      </small>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedOpportunity(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        executeArbitrage(
                          selectedOpportunity.id,
                          selectedOpportunity.tokenA,
                          selectedOpportunity.tokenB,
                          amount
                        );
                        setSelectedOpportunity(null);
                      }}
                      disabled={executing}
                    >
                      {executing ? 'Executing...' : 'Execute'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="row">
            <div className="col-12 text-center">
              <button
                className="btn btn-outline-primary"
                onClick={loadOpportunities}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Opportunities'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ArbitrageOpportunities; 