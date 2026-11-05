# DOK-NFT service boundary

The DOK-NFT rights/vault service is maintained in the separate `ohllmuzz/dok-nft-mvp` repository. Minerx remains the DEX arbitrage application. This repository does not import, vendor, or embed the DOK-NFT service.

Likewise, market-intelligence ingestion and cross-venue surveillance are not implemented here. Keep service integrations behind explicit, versioned APIs rather than sharing mutable application state or secrets.
