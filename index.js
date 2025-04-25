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
    const totalNeeded = 11220; // Total de velas desejadas (120 dias x 24h x 4 velas)
    let allCloses = [];
    const filename = `data/${symbol}_5m.txt`; // Nome do arquivo baseado no símbolo
    console.log(symbol);

    while (allCloses.length < totalNeeded) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
                params: {
                    symbol: symbol,
                    interval: "5m",
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
    const startTime = Date.now() - (120 * 24 * 60 * 60 * 1000); // 120 dias de velas
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
   
    const insertResultsSql = `INSERT INTO resultados (simbolo, lucro, nr_operacoes, saldo) VALUES (?, ?, ?, ?)`;
    connection.query(insertResultsSql, [symbol, capital - INITIAL_CAPITAL, trades, capital], (error) => {
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
            
            // Espera 2 minutos antes de continuar para o próximo símbolo
            await new Promise(resolve => setTimeout(resolve, 10000)); // 600.000 milissegundos = 1 minutos
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

