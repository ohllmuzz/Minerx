const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());
    
    // Deploy ARBX Token
    console.log("\nDeploying ARBX Token...");
    const ARBXToken = await ethers.getContractFactory("ARBXToken");
    const arbxToken = await ARBXToken.deploy();
    await arbxToken.deployed();
    console.log("ARBX Token deployed to:", arbxToken.address);
    
    // Deploy ArbitrageX Exchange
    console.log("\nDeploying ArbitrageX Exchange...");
    const ArbitrageXExchange = await ethers.getContractFactory("ArbitrageXExchange");
    const exchange = await ArbitrageXExchange.deploy(arbxToken.address);
    await exchange.deployed();
    console.log("ArbitrageX Exchange deployed to:", exchange.address);
    
    // Deploy Hybrid DEX
    console.log("\nDeploying Hybrid DEX...");
    const HybridDEX = await ethers.getContractFactory("HybridDEX");
    
    // Polygon DEX addresses
    const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
    const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    
    const hybridDEX = await HybridDEX.deploy(arbxToken.address, QUICKSWAP_ROUTER, SUSHISWAP_ROUTER);
    await hybridDEX.deployed();
    console.log("Hybrid DEX deployed to:", hybridDEX.address);
    
    // Deploy Arbitrage Bot
    console.log("\nDeploying Arbitrage Bot...");
    const ArbitrageBot = await ethers.getContractFactory("ArbitrageBot");
    
    const bot = await ArbitrageBot.deploy(QUICKSWAP_ROUTER, SUSHISWAP_ROUTER, exchange.address);
    await bot.deployed();
    console.log("Arbitrage Bot deployed to:", bot.address);
    
    // Set up initial configuration
    console.log("\nSetting up initial configuration...");
    
    // Transfer some ARBX tokens to the exchange for initial liquidity
    const initialLiquidity = ethers.utils.parseEther("1000000"); // 1M tokens
    await arbxToken.transfer(exchange.address, initialLiquidity);
    console.log("Transferred", ethers.utils.formatEther(initialLiquidity), "ARBX tokens to exchange");
    
    // Set exchange as governance member
    await arbxToken.addGovernanceMember(exchange.address);
    console.log("Added exchange as governance member");
    
    // Create some initial arbitrage opportunities
    console.log("\nCreating initial arbitrage opportunities...");
    
    // Example opportunity: MATIC/USDC
    const MATIC_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB";
    const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
    
    // Create opportunities with different price spreads
    await exchange.createArbitrageOpportunity(
        MATIC_ADDRESS,
        USDC_ADDRESS,
        ethers.utils.parseEther("1"), // 1 MATIC
        ethers.utils.parseUnits("1.02", 6), // 1.02 USDC (2% higher)
        ethers.utils.parseEther("100"), // Min 100 MATIC
        ethers.utils.parseEther("10000"), // Max 10,000 MATIC
        3600 // 1 hour duration
    );
    
    await exchange.createArbitrageOpportunity(
        WETH_ADDRESS,
        USDC_ADDRESS,
        ethers.utils.parseEther("1"), // 1 WETH
        ethers.utils.parseUnits("1800", 6), // 1800 USDC
        ethers.utils.parseEther("0.1"), // Min 0.1 WETH
        ethers.utils.parseEther("10"), // Max 10 WETH
        7200 // 2 hours duration
    );
    
    console.log("Created initial arbitrage opportunities");
    
    // Set bot configuration
    console.log("\nSetting bot configuration...");
    await bot.setConfiguration(
        100, // 1% minimum profit
        50,  // 0.5% max slippage
        ethers.utils.parseUnits("50", "gwei") // 50 gwei gas limit
    );
    console.log("Bot configuration set");
    
    // Verify contracts on PolygonScan
    console.log("\nWaiting for block confirmations...");
    await arbxToken.deployTransaction.wait(5);
    await exchange.deployTransaction.wait(5);
    await bot.deployTransaction.wait(5);
    
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("ARBX Token:", arbxToken.address);
    console.log("ArbitrageX Exchange:", exchange.address);
    console.log("Hybrid DEX:", hybridDEX.address);
    console.log("Arbitrage Bot:", bot.address);
    console.log("Network: Polygon Mainnet");
    console.log("Deployer:", deployer.address);
    
    console.log("\n=== NEXT STEPS ===");
    console.log("1. Verify contracts on PolygonScan");
    console.log("2. Set up frontend application");
    console.log("3. Configure monitoring and alerts");
    console.log("4. Test arbitrage execution");
    console.log("5. Launch platform");
    
    // Save deployment addresses
    const deploymentInfo = {
        network: "polygon",
        deployer: deployer.address,
        contracts: {
            arbxToken: arbxToken.address,
            exchange: exchange.address,
            hybridDEX: hybridDEX.address,
            bot: bot.address
        },
        dexes: {
            quickswapRouter: QUICKSWAP_ROUTER,
            sushiswapRouter: SUSHISWAP_ROUTER
        },
        tokens: {
            matic: MATIC_ADDRESS,
            usdc: USDC_ADDRESS,
            weth: WETH_ADDRESS
        }
    };
    
    const fs = require("fs");
    fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to deployment.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 