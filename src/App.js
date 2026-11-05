import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import Navbar from './components/Navbar';
import { Web3Provider } from './context/Web3Context';
import { createContracts } from './services/contractRegistry';

const Dashboard = lazy(() => import('./components/Dashboard'));
const ArbitrageOpportunities = lazy(() => import('./components/ArbitrageOpportunities'));
const Staking = lazy(() => import('./components/Staking'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const Admin = lazy(() => import('./components/Admin'));

const REQUIRED_CHAIN_ID = 137n;
const DEPLOYMENT_URL = '/deployment.json';

function normalizeContractAddresses(contracts = {}) {
  const required = ['arbxToken', 'exchange', 'hybridDEX', 'bot'];
  return Object.fromEntries(required.map((name) => {
    const address = contracts[name];
    if (!ethers.isAddress(address || '') || address === ethers.ZeroAddress) {
      throw new Error(`Missing or invalid deployment address: ${name}`);
    }
    return [name, ethers.getAddress(address)];
  }));
}

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contracts, setContracts] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractAddresses, setContractAddresses] = useState(null);
  const addressesRef = useRef(null);
  const initWalletRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    fetch(DEPLOYMENT_URL, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Deployment config request failed (${response.status})`);
        return response.json();
      })
      .then((deployment) => {
        const addresses = normalizeContractAddresses(deployment?.contracts);
        if (mounted) {
          addressesRef.current = addresses;
          setContractAddresses(addresses);
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Unable to load deployment config:', error);
          toast.error('Contract deployment config unavailable; wallet actions are disabled.');
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const disconnectWallet = useCallback((notify = true) => {
    setAccount(null);
    setProvider(null);
    setContracts({});
    setIsConnected(false);
    if (notify) toast.info('Wallet disconnected');
  }, []);

  const initializeWallet = useCallback(async (accounts) => {
    if (!window.ethereum) throw new Error('Please install a supported wallet');
    if (!addressesRef.current) throw new Error('Deployment configuration is not ready');

    const web3Provider = new ethers.BrowserProvider(window.ethereum, 'any');
    const network = await web3Provider.getNetwork();
    if (network.chainId !== REQUIRED_CHAIN_ID) {
      disconnectWallet(false);
      throw new Error('Switch your wallet to Polygon (chain ID 137)');
    }

    const selectedAccounts = accounts || await window.ethereum.request({ method: 'eth_accounts' });
    if (!selectedAccounts?.length) {
      disconnectWallet(false);
      return;
    }

    const signer = await web3Provider.getSigner(selectedAccounts[0]);
    const [signerAddress, instances] = await Promise.all([
      signer.getAddress(),
      createContracts(addressesRef.current, signer)
    ]);

    setProvider(web3Provider);
    setAccount(ethers.getAddress(signerAddress));
    setContracts(instances);
    setIsConnected(true);
  }, [disconnectWallet]);

  initWalletRef.current = initializeWallet;

  useEffect(() => {
    if (!window.ethereum) return undefined;

    const onAccountsChanged = (accounts) => {
      if (!accounts?.length) {
        disconnectWallet(false);
        return;
      }
      initWalletRef.current?.(accounts).catch((error) => {
        console.error('Account update failed:', error);
        toast.error(error.message || 'Unable to update wallet account');
      });
    };

    const onChainChanged = () => {
      initWalletRef.current?.().catch((error) => {
        console.error('Network update failed:', error);
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
    if (!addressesRef.current || !window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => accounts.length && initWalletRef.current?.(accounts))
      .catch((error) => console.error('Wallet reconnect check failed:', error));
  }, [contractAddresses]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Please install a supported wallet');
      return;
    }
    if (!addressesRef.current) {
      toast.error('Contract deployment config is not ready');
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

  const contextValue = useMemo(() => ({
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
    <Web3Provider value={contextValue}>
      <Router>
        <div className="App">
          <Navbar />
          <main className="container-fluid">
            <Suspense fallback={<div className="py-5 text-center" role="status">Loading workspace…</div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/opportunities" element={<ArbitrageOpportunities />} />
                <Route path="/staking" element={<Staking />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </main>
          <ToastContainer position="top-right" autoClose={5000} closeOnClick pauseOnFocusLoss draggable pauseOnHover />
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
