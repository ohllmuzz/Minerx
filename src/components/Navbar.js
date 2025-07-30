import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

const Navbar = () => {
  const { account, isConnected, connectWallet, disconnectWallet, loading } = useWeb3();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleWalletAction = () => {
    if (isConnected) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  };

  const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">
          <span className="text-warning">🚀</span> ArbitrageX
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/')}`} to="/">
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/opportunities')}`} to="/opportunities">
                Opportunities
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/staking')}`} to="/staking">
                Staking
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/portfolio')}`} to="/portfolio">
                Portfolio
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/admin')}`} to="/admin">
                Admin
              </Link>
            </li>
          </ul>

          <div className="navbar-nav">
            <div className="nav-item">
              <button
                className={`btn ${isConnected ? 'btn-success' : 'btn-outline-light'}`}
                onClick={handleWalletAction}
                disabled={loading}
              >
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Connecting...
                  </span>
                ) : isConnected ? (
                  <span>
                    <span className="text-success">●</span> {shortenAddress(account)}
                  </span>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 