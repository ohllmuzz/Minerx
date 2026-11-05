# Minerx workspace migration and security notes

This refactor is incremental: the existing React/Hardhat app remains the source of truth while shared concerns are extracted behind modules. It does not claim production security or validated live execution.

## Current migration seams

- `src/services/contractRegistry.js` centralizes contract interface definitions and instance creation.
- `src/config/networks.js` centralizes Polygon chain and token/router constants.
- `src/services/RealDataService.js` provides cached, bounded-concurrency reads and uses token-reported decimals.
- `src/core/arbitrage.js` holds pure opportunity math outside UI components.
- `src/App.js` lazy-loads route components, validates deployment addresses and checks Polygon before creating signer-backed contracts.

## Local development

The existing Create React App and Hardhat scripts are deliberately retained for this first migration pass. Do not move Solidity or alter the lockfile until CI confirms the current application and contract builds. Load deployment addresses from `public/deployment.json` with `contracts` keys `arbxToken`, `exchange`, `hybridDEX`, and `bot`.

## Security boundaries

- Never put a deployer/private key or privileged server secret in the browser or a `REACT_APP_*` variable.
- A browser wallet signer may only sign user-authorized transactions; validate chain, contract addresses, token, amount, and transaction preview before prompting.
- The UI is not an authorization boundary. Owner-only Solidity functions remain enforced by the contracts.
- Price quotes are estimates, not execution guarantees. Refresh and simulate immediately before submission; enforce minimum output/deadline on-chain.
- Treat the current contracts as unaudited prototypes. Do not deploy or use with material funds before independent review and tests.

## Next migration stages

1. Add CI build/test gates and fix ethers v6 compatibility across legacy pages.
2. Add read-only public provider mode and move wallet context into a tested provider module.
3. Extract feature modules for market intel, execution, portfolio, staking, and admin; keep route-level lazy loading.
4. Add a verified Multicall implementation and query cache; measure RPC load before/after.
5. Migrate to pnpm/Turbo only after the app works from this baseline, then move Hardhat into `packages/contracts` without duplicating artifacts.
6. Perform contract threat modeling, unit/fuzz/invariant tests, and an external audit before deployment.
