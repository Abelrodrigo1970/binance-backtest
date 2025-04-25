const axios = require("axios");
const fs = require("fs");
const mysql = require("mysql");
const { movingAverageCrossoverStrategy } = require('./strategy.js');
const { console } = require("inspector");

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root', // Seu usuário do banco de dados
    password: 'sua_senha', // Sua senha do banco de dados, se houver
    database: 'criptomoedas' // O nome do seu banco de dados
});

// Configurações iniciais
const INITIAL_CAPITAL = 200; // Capital inicial em USDT
const TRADE_AMOUNT = 100; // Valor fixo por operação em USDT

const PERIODO_M = "15m"; // Defina o período desejado
const totalDays = 90; // Número de dias
const minutesInADay = 24 * 60; // Número de minutos em um dia

// Função para calcular o número total de velas
function calculateTotalCandlesticks(period) {
    let minutesPerCandle;

    // Usa switch para definir minutos por vela com base no período
    switch (period) {
        case "5m":
            minutesPerCandle = 5;
            break;
        case "15m":
            minutesPerCandle = 15;
            break;
        case "30m":
            minutesPerCandle = 30;
            break;
        case "1h":
                minutesPerCandle = 60;
                break;
        case "2h":
                minutesPerCandle = 120;
                break;
        default:
            throw new Error(`Período "${period}" não é suportado.`);
    }

    // Calcula o total de minutos em 90 dias
    const totalMinutes = totalDays * minutesInADay;

    // Calcula e retorna o total de velas
    return totalMinutes / minutesPerCandle;
}


// Função para buscar os símbolos do banco de dados
async function fetchSymbols() {
    return new Promise((resolve, reject) => {
        connection.query('SELECT simbolo FROM criptomoedas', (error, results) => {
            if (error) return reject(error);
            resolve(results.map(row => row.simbolo)); // Extrai os símbolos do resultado
            console.log(results);
        });
    });
}

// Função para baixar as velas (candlesticks) de um símbolo específico
async function downloadCandlest(symbol, startTime) {
    const totalNeeded = calculateTotalCandlesticks(PERIODO_M);
    console.log(`Total de velas necessárias para ${totalDays} dias com período de ${PERIODO_M}: ${totalNeeded}`);

    let allCloses = [];
    const filename = `data/${symbol}_5m.txt`; // Nome do arquivo baseado no símbolo
    console.log(symbol);

    while (allCloses.length < totalNeeded) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
                params: {
                    symbol: symbol,
                    interval: PERIODO_M,
                    limit: 1000,
                    startTime: startTime
                }
            });

            // Verificar se a resposta contém dados
            if (!response.data || response.data.length === 0) {
                console.log(`Nenhum dado retornado para o símbolo ${symbol}.`);
                return null; // Retorna null para indicar que não há dados para este símbolo
            }

            const closes = response.data.map(k => k[4]); // Fecha as velas
            console.log(`Número de velas baixadas para ${symbol}: ${closes.length}`);
            allCloses.push(...closes); // Adiciona as novas velas à lista

            const lastTimestamp = response.data[response.data.length - 1][6];
            startTime = lastTimestamp + 1; // Atualiza o startTime para a próxima chamada

            // Se não houver mais dados, sai do loop
            if (closes.length < 1000) {
                break;
            }
        } catch (error) {
            console.error("Erro ao obter os dados:", error.message);
            return null; // Retorna null em caso de erro
        }
    }

    // Limpa o arquivo e escreve todos os dados das velas acumuladas
    fs.writeFileSync(filename, allCloses.join("\n"));
    console.log(`Total de velas coletadas para ${symbol}: ${allCloses.length}`);
    return filename; // Retorna o nome do arquivo
}

// Função para realizar o backtest para um símbolo específico
async function doBacktestForSymbol(symbol) {
    const startTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 dias de velas
    const filename = await downloadCandlest(symbol, startTime);

    if (!filename) { // Se o downloadFalhou, retorna para a função calling
        console.log(`Símbolo ${symbol} inválido ou sem dados. Passando para o próximo símbolo.`);
        return;
    }

    let closes = fs.readFileSync(filename, { encoding: "utf-8" }).split("\n").map(parseFloat);
    
    // Variáveis para o backtest
    let capital = INITIAL_CAPITAL;
    let ethBalance = 0;

    // Chamando a estratégia definida em strategy.js
    const results = movingAverageCrossoverStrategy(closes, capital, ethBalance, TRADE_AMOUNT, symbol);
    
    // Armazena os resultados
    capital = results.capital;
    ethBalance = results.ethBalance;
    let trades = results.trades;

    // Insira os resultados na tabela no banco de dados
   console.log(PERIODO_M);
    const insertResultsSql = `INSERT INTO resultados (simbolo, lucro, nr_operacoes, saldo, periodo) VALUES (?, ?, ?, ?, ?)`;
    connection.query(insertResultsSql, [symbol, capital - INITIAL_CAPITAL, trades, capital, PERIODO_M], (error) => {
        if (error) throw error;
        console.log(`Resultados inseridos para ${symbol}: Lucro: ${capital - INITIAL_CAPITAL} USDT, Operações: ${trades}, Saldo: ${ethBalance}`);
    });
}
// Função principal

async function main() {
    try {
        console.log('Iniciando o processo de backtest...');
        const symbolList = await fetchSymbols(); // Busca os símbolos do banco de dados

        if (!symbolList.length) {
            console.log('Nenhum símbolo encontrado no banco de dados.');
            return; // Encerra se não houver símbolos para processar
        }

        console.log(`Símbolos a serem processados: ${symbolList.join(', ')}`);

        for (const symbol of symbolList) {
            console.log(`Processando símbolo: ${symbol}`);
            await doBacktestForSymbol(symbol); // Executa o backtest para cada símbolo
            
            // Espera 10 SEGUNDOS  antes de continuar para o próximo símbolo
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10.000 milissegundos = 10 segundos 
        }
        
        console.log('Backtest completo para todos os símbolos!');
    } catch (error) {
        console.error("Erro ao executar o backtest:", error);
    } finally {
        // Queremos fechar a conexão com o banco de dados ao final
        connection.end();
    }

}

// Iniciar o processo principal
main().catch(error => console.error("Erro crítico no bot:", error));

