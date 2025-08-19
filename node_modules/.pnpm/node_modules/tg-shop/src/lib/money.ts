export const money = (cents: number, cur = 'USD') => `${(cents/100).toFixed(2)} ${cur}`;
