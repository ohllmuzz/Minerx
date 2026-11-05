export function calculateNetSpread({ buyPrice, sellPrice, amountIn, gasCost = 0, slippageBps = 0, feeBps = 0 }) {
  const values = [buyPrice, sellPrice, amountIn, gasCost, slippageBps, feeBps].map(Number);
  if (values.some((value) => !Number.isFinite(value)) || buyPrice <= 0 || amountIn <= 0) {
    throw new TypeError('Prices and amount must be finite; buyPrice and amountIn must be positive');
  }
  const [buy, sell, amount, gas, slippage, fee] = values;
  const gross = (sell - buy) * amount;
  const variableCost = buy * amount * ((slippage + fee) / 10_000);
  const net = gross - variableCost - gas;
  return { gross, variableCost, gas, net, netBps: (net / (buy * amount)) * 10_000 };
}

export function rankOpportunities(opportunities, { minNetBps = 0 } = {}) {
  return opportunities
    .filter((item) => Number.isFinite(Number(item.netBps)) && Number(item.netBps) >= minNetBps)
    .slice()
    .sort((a, b) => Number(b.netBps) - Number(a.netBps));
}
