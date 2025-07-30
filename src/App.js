import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ArbitrageOpportunities from './components/ArbitrageOpportunities';
import Staking from './components/Staking';
import Portfolio from './components/Portfolio';
import Admin from './components/Admin';

        // Contracts
        import ARBXTokenABI from './contracts/ARBXToken.json';
        import ArbitrageXExchangeABI from './contracts/ArbitrageXExchange.json';
        import HybridDEXABI from './contracts/HybridDEX.json';
        import ArbitrageBotABI from './contracts/ArbitrageBot.json';

// Context
import { Web3Provider } from './context/Web3Context';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contracts, setContracts] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Contract addresses (will be loaded from deployment.json)
          const [contractAddresses, setContractAddresses] = useState({
            arbxToken: '',
            exchange: '',
            hybridDEX: '',
            bot: ''
        });

  useEffect(() => {
    loadDeploymentInfo();
    checkWalletConnection();
  }, []);

  const loadDeploymentInfo = async () => {
    try {
      const response = await fetch('/deployment.json');
      const deploymentInfo = await response.json();
              setContractAddresses({
            arbxToken: deploymentInfo.contracts.arbxToken,
            exchange: deploymentInfo.contracts.exchange,
            hybridDEX: deploymentInfo.contracts.hybridDEX,
            bot: deploymentInfo.contracts.bot
        });
    } catch (error) {
      console.error('Error loading deployment info:', error);
    }
  };

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setLoading(true);
        
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        const account = accounts[0];
        setAccount(account);

        // Create provider and signer
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Check if we're on Polygon
        const network = await provider.getNetwork();
        if (network.chainId !== 137) {
          toast.error('Please connect to Polygon network');
          return;
        }

        setProvider(provider);
        setIsConnected(true);

        // Initialize contracts
        const arbxToken = new ethers.Contract(
          contractAddresses.arbxToken,
          ARBXTokenABI.abi,
          signer
        );

                const exchange = new ethers.Contract(
            contractAddresses.exchange,
            ArbitrageXExchangeABI.abi,
            signer
        );

        const hybridDEX = new ethers.Contract(
            contractAddresses.hybridDEX,
            HybridDEXABI.abi,
            signer
        );

        const bot = new ethers.Contract(
            contractAddresses.bot,
            ArbitrageBotABI.abi,
            signer
        );

        setContracts({
            arbxToken,
            exchange,
            hybridDEX,
            bot
        });

        toast.success('Wallet connected successfully!');

        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          } else {
            disconnectWallet();
          }
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', (chainId) => {
          if (chainId !== '0x89') { // Polygon chainId
            toast.error('Please switch to Polygon network');
            disconnectWallet();
          }
        });

      } catch (error) {
        console.error('Error connecting wallet:', error);
        toast.error('Failed to connect wallet');
      } finally {
        setLoading(false);
      }
    } else {
      toast.error('Please install MetaMask');
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setContracts({});
    setIsConnected(false);
    toast.info('Wallet disconnected');
  };

  const web3ContextValue = {
    account,
    provider,
    contracts,
    isConnected,
    loading,
    connectWallet,
    disconnectWallet,
    contractAddresses
  };

  return (
    <Web3Provider value={web3ContextValue}>
      <Router>
        <div className="App">
          <Navbar />
          
          <main className="container-fluid">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/opportunities" element={<ArbitrageOpportunities />} />
              <Route path="/staking" element={<Staking />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>

          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App; 