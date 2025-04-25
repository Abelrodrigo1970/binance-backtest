const axios = require('axios');
const mysql = require('mysql');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root', // Seu usuário do banco de dados
    password: 'sua_senha', // Sua senha do banco de dados, se houver
    database: 'criptomoedas' // O nome do seu banco de dados
});

// Função para criar a tabela, caso não exista
const createTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS criptomoedas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            simbolo VARCHAR(10) NOT NULL UNIQUE
        );
    `;
    connection.query(sql, (error) => {
        if (error) throw error;
        console.log('Tabela criptomoedas criada ou já existe.');
        fetchCryptocurrencies(); // Obtém as criptomoedas após criar a tabela
    });
};

// Função para obter criptomoedas da API CoinGecko
const fetchCryptocurrencies = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 100, // Número de criptomoedas por página
                page: 6,
                sparkline: false
            }
        });

        const cryptocurrencies = response.data.map(coin => ({
            simbolo: (coin.symbol.toUpperCase() + 'USDT') // Colocando em maiúsculas e adicionando 'USDT'
     
    }));    
        // Inserir criptomoedas na tabela
    insertCryptocurrencies(cryptocurrencies);
    } catch (error) {
        console.error('Erro ao buscar criptomoedas:', error);
        connection.end(); // Fecha a conexão em caso de erro
    }
};

// Função para inserir criptomoedas no banco de dados
const insertCryptocurrencies = (cryptocurrencies) => {
    const sql = 'INSERT IGNORE INTO criptomoedas (simbolo) VALUES ?'; // Usar INSERT IGNORE
    const values = cryptocurrencies.map(coin => [coin.simbolo]);

    connection.query(sql, [values], (error) => {
        if (error) throw error;
        console.log('Criptomoedas inseridas com sucesso.');
        connection.end(); // Fecha a conexão após a inserção
    });
};

// Função para criar a tabela de resultados, caso não exista
const createResultsTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS resultados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            simbolo VARCHAR(10) NOT NULL,
            lucro DECIMAL(20, 10),
            nr_operacoes INT,
            saldo DECIMAL(20, 10),
            periodo VARCHAR(10) NOT NULL
        );
    `;
    connection.query(sql, (error) => {
        if (error) throw error;
        console.log('Tabela resultados criada ou já existe.');
        // Você pode chamar outras funções aqui, se necessário
    });
};


// Conectar ao banco de dados
connection.connect((err) => {
    if (err) {
        console.error(`Erro ao conectar ao banco de dados: ${err.message}`);
        return;
    }
    console.log('Conectado ao banco de dados com sucesso!');
    createTable(); // Chama a função para criar a tabela 'criptomoedas'
    createResultsTable(); // Chama a função para criar a tabela 'resultados'
});
