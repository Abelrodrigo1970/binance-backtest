function movingAverageCrossoverStrategy(closes, capital, ethBalance, TRADE_AMOUNT, SYMBOL) {
    let sma7 = calculateSMA(closes, 6);
    let sma20 = calculateSMA(closes, 21);
    
    let position = null;
    let trades = 0;

    for (let i = 20; i < closes.length; i++) {
        let price = closes[i];
        let transactionTime = new Date((Date.now() - (closes.length - i) * 15 * 60 * 1000)).toISOString(); // Calcula a hora baseado na posição

        // Compra quando a SMA de 7 cruza acima da SMA de 20
        if (sma7[i] > sma20[i] && sma7[i - 1] <= sma20[i - 1] && position !== 'long' && capital >= TRADE_AMOUNT) {
            if (position === 'short') {
                capital += ethBalance * price;
                ethBalance = 0;
            }
            ethBalance = TRADE_AMOUNT / price;
            capital -= TRADE_AMOUNT;
            position = 'long';
            trades++;
            console.log(`Compra: ${TRADE_AMOUNT} USDT em ${SYMBOL} a ${price} | Saldo: ${capital} USDT | ${SYMBOL}: ${ethBalance} | Data e Hora: ${transactionTime}`);
        } 
        // Venda quando a SMA de 7 cruza abaixo da SMA de 20
        else if (sma7[i] < sma20[i] && sma7[i - 1] >= sma20[i - 1] && position === 'long') {
            capital += ethBalance * price;
            ethBalance = 0;
            position = 'short';
            trades++;
            console.log(`Venda: ${TRADE_AMOUNT} USDT de ${SYMBOL} a ${price} | Saldo: ${capital} USDT | Data e Hora: ${transactionTime}`);
        }
    }

    if (position === 'long') {
        // Vender toda a posição caso ainda esteja "long"
        capital += ethBalance * closes[closes.length - 1]; // Vender ao último preço disponível
        ethBalance = 0; // Liquidar o saldo de ETH
        console.log(`Venda de encerramento: ${ethBalance} de ${SYMBOL} a ${closes[closes.length - 1]} | Saldo: ${capital} USDT | Data e Hora: ${new Date().toISOString()}`);
    }
    

    return { capital, ethBalance, trades };
}

function calculateSMA(values, period) {
    let sma = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period) {
            sma.push(NaN);
        } else {
            let sum = values.slice(i - period, i).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
    }
    return sma;
}

module.exports = { movingAverageCrossoverStrategy };

