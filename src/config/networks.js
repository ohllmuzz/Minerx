export const POLYGON = Object.freeze({
  chainId: 137,
  name: 'Polygon',
  routers: Object.freeze({
    quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
  }),
  tokens: Object.freeze({
    MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AcfeBEBB',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
  })
});

export const REQUIRED_CHAIN_IDS = Object.freeze([POLYGON.chainId]);
