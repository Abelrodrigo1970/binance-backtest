function calculateRSI(closes, period = 14) {
    let gains = 0;
    let losses = 0;
    let rsi = [];

    for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses -= change; // Mantém o valor positivo
        }

        if (i >= period) {
            if (i > period) {
                const prevChange = closes[i - period] - closes[i - period - 1];
                gains -= prevChange > 0 ? prevChange : 0;
                losses -= prevChange < 0 ? -prevChange : 0;
            }
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        } else {
            rsi.push(NaN);
        }
    }
    return rsi;
}

function movingAverageCrossoverStrategyWithRSI(closes, capital, ethBalance, TRADE_AMOUNT, SYMBOL) {
    let rsi = calculateRSI(closes);
    let position = null; // 'long' ou 'short'
    let trades = 0;
    let purchasePrice = 0; // Preço de compra inicial
    const stopLossPercentage = 0.05; // 5% de stop-loss

    for (let i = 1; i < rsi.length; i++) {
        let price = closes[i];

        // Compra quando RSI < 30 e depois cruza acima de 30
        if (rsi[i - 1] < 30 && rsi[i] >= 30 && position !== 'long' && capital >= TRADE_AMOUNT) {
            purchasePrice = price; // Armazena o preço de compra
            ethBalance = TRADE_AMOUNT / purchasePrice;
            capital -= TRADE_AMOUNT;
            position = 'long';
            trades++;
            console.log(`Compra: ${TRADE_AMOUNT} USDT em ${SYMBOL} a ${price} | Saldo: ${capital} USDT | ${SYMBOL}: ${ethBalance}`);
        } 
        // Venda quando RSI > 70 e depois cruza abaixo de 70
        else if (rsi[i - 1] > 70 && rsi[i] <= 70 && position === 'long') {
            capital += ethBalance * price;
            ethBalance = 0;
            position = null;
            trades++;
            console.log(`Venda: ${TRADE_AMOUNT} USDT de ${SYMBOL} a ${price} | Saldo: ${capital} USDT`);
        }

        // Implementação do Stop-Loss
        if (position === 'long' && price < (purchasePrice * (1 - stopLossPercentage))) {
            capital += ethBalance * price;
            ethBalance = 0;
            position = null;
            trades++;
            console.log(`Stop-Loss ativado: Venda forçada de ${SYMBOL} a ${price} | Saldo: ${capital} USDT`);
        }
    }

    return { capital, ethBalance, trades };
}

module.exports = { movingAverageCrossoverStrategyWithRSI, calculateRSI };
