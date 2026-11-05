import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ArbitrageOpportunities from './components/ArbitrageOpportunities';
import Staking from './components/Staking';
import Portfolio from './components/Portfolio';
import Admin from './components/Admin';

import ARBXTokenABI from './contracts/ARBXToken.json';
import ArbitrageXExchangeABI from './contracts/ArbitrageXExchange.json';
import HybridDEXABI from './contracts/HybridDEX.json';
import ArbitrageBotABI from './contracts/ArbitrageBot.json';
import { Web3Provider } from './context/Web3Context';

const REQUIRED_CHAIN_ID = 137n;
const DEPLOYMENT_URL = '/deployment.json';
const CONTRACTS = [
  ['arbxToken', ARBXTokenABI],
  ['exchange', ArbitrageXExchangeABI],
  ['hybridDEX', HybridDEXABI],
  ['bot', ArbitrageBotABI]
];

function normalizeAddress(value, name) {
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`Missing or invalid ${name} deployment address`);
  }
  return ethers.getAddress(value);
}

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contracts, setContracts] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deploymentReady, setDeploymentReady] = useState(false);
  const [contractAddresses, setContractAddresses] = useState(null);
  const addressesRef = useRef(null);
  const initializeWalletRef = useRef(null);

  useEffect(() => {
    let active = true;

    fetch(DEPLOYMENT_URL, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Deployment config request failed (${response.status})`);
        return response.json();
      })
      .then((deployment) => {
        const source = deployment?.contracts;
        if (!source) throw new Error('Deployment config has no contracts object');

        const addresses = Object.fromEntries(
          CONTRACTS.map(([key]) => [key, normalizeAddress(source[key], key)])
        );

        if (active) {
          addressesRef.current = addresses;
          setContractAddresses(addresses);
          setDeploymentReady(true);
        }
      })
      .catch((error) => {
        console.error('Unable to load deployment config:', error);
        if (active) {
          setDeploymentReady(true);
          toast.error('Contract deployment configuration is unavailable. Wallet actions are disabled.');
        }
      });

    return () => { active = false; };
  }, []);

  const disconnectWallet = useCallback((notify = true) => {
    setAccount(null);
    setProvider(null);
    setContracts({});
    setIsConnected(false);
    if (notify) toast.info('Wallet disconnected');
  }, []);

  const initializeWallet = useCallback(async (requestedAccounts) => {
    if (!window.ethereum) throw new Error('Please install a supported wallet');
    if (!addressesRef.current) throw new Error('Contract deployment configuration is not ready');

    const web3Provider = new ethers.BrowserProvider(window.ethereum, 'any');
    const network = await web3Provider.getNetwork();
    if (network.chainId !== REQUIRED_CHAIN_ID) {
      disconnectWallet(false);
      throw new Error('Switch your wallet to Polygon (chain ID 137)');
    }

    const accounts = requestedAccounts || await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts?.length) {
      disconnectWallet(false);
      return;
    }

    const signer = await web3Provider.getSigner(accounts[0]);
    const signerAddress = ethers.getAddress(await signer.getAddress());
    const instances = Object.fromEntries(
      CONTRACTS.map(([key, artifact]) => [
        key,
        new ethers.Contract(addressesRef.current[key], artifact.abi, signer)
      ])
    );

    setProvider(web3Provider);
    setAccount(signerAddress);
    setContracts(instances);
    setIsConnected(true);
  }, [disconnectWallet]);

  initializeWalletRef.current = initializeWallet;

  useEffect(() => {
    if (!window.ethereum) return undefined;

    const onAccountsChanged = (accounts) => {
      if (!accounts?.length) {
        disconnectWallet(false);
        return;
      }
      initializeWalletRef.current?.(accounts).catch((error) => {
        console.error('Wallet account update failed:', error);
        toast.error(error.message || 'Unable to update wallet account');
      });
    };

    const onChainChanged = () => {
      initializeWalletRef.current?.().catch((error) => {
        console.error('Wallet network update failed:', error);
        toast.error(error.message || 'Unable to update wallet network');
      });
    };

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', onChainChanged);
    };
  }, [disconnectWallet]);

  useEffect(() => {
    if (!deploymentReady || !addressesRef.current || !window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => accounts.length && initializeWalletRef.current?.(accounts))
      .catch((error) => console.error('Wallet auto-connect check failed:', error));
  }, [deploymentReady]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Please install a supported wallet');
      return;
    }
    if (!addressesRef.current) {
      toast.error('Contract configuration is not ready');
      return;
    }

    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await initializeWallet(accounts);
      toast.success('Wallet connected to Polygon');
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }, [initializeWallet]);

  const web3ContextValue = useMemo(() => ({
    account,
    provider,
    contracts,
    isConnected,
    loading,
    connectWallet,
    disconnectWallet,
    contractAddresses
  }), [account, provider, contracts, isConnected, loading, connectWallet, disconnectWallet, contractAddresses]);

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
          <ToastContainer position="top-right" autoClose={5000} closeOnClick pauseOnFocusLoss draggable pauseOnHover />
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
