-- banco.sql
CREATE DATABASE IF NOT EXISTS infoabrigo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE infoabrigo;

-- As contas, abrigos, necessidades, doações e compromissos ficam no Firebase. Aqui
-- fica o que precisa ser decidido ou guardado fora do alcance do aplicativo.

-- O plano gratuito do Firebase não inclui o Storage. A foto é servida por um endereço
-- público com id aleatório, porque o mapa precisa abri-la sem enviar sessão.
CREATE TABLE IF NOT EXISTS arquivos (
    id CHAR(32) PRIMARY KEY,
    uid VARCHAR(128) NOT NULL,
    mime VARCHAR(40) NOT NULL,
    dados MEDIUMBLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_arquivos_uid (uid)
);

-- O histórico de cada conferência de CNPJ, feita sempre pelo servidor.
CREATE TABLE IF NOT EXISTS verificacoes (
    abrigo_id VARCHAR(64) PRIMARY KEY,
    uid VARCHAR(128) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    razao_social VARCHAR(200) NOT NULL DEFAULT '',
    situacao VARCHAR(40) NOT NULL DEFAULT '',
    verificado TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_verificacoes_cnpj (cnpj),
    INDEX idx_verificacoes_uid (uid)
);

-- Uma denúncia por pessoa em cada abrigo: repetir não aumenta a contagem.
CREATE TABLE IF NOT EXISTS denuncias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    abrigo_id VARCHAR(64) NOT NULL,
    uid VARCHAR(128) NOT NULL,
    motivo VARCHAR(40) NOT NULL,
    detalhe VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    UNIQUE KEY uq_denuncia (abrigo_id, uid),
    INDEX idx_denuncias_uid (uid)
);
