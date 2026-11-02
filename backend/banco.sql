-- banco.sql
CREATE DATABASE IF NOT EXISTS infoabrigo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE infoabrigo;

CREATE TABLE IF NOT EXISTS contas (
    email VARCHAR(200) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    perfil VARCHAR(20) NOT NULL,
    instituicao JSON NULL,
    telefone VARCHAR(40) NOT NULL DEFAULT '',
    sal VARCHAR(100) NOT NULL,
    senha_protegida VARCHAR(200) NOT NULL,
    pergunta VARCHAR(200) NOT NULL DEFAULT '',
    resposta_protegida VARCHAR(200) NOT NULL DEFAULT '',
    versao_sessao INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Abrigos, necessidades, doações e compromissos têm muitos campos opcionais que
-- mudam junto com as telas. As colunas são o que o servidor usa para decidir
-- permissão e ordem; o registro inteiro fica em `dados`. O id é criado pelo
-- aplicativo, porque o registro nasce no celular, mesmo sem internet.
CREATE TABLE IF NOT EXISTS abrigos (
    id VARCHAR(64) PRIMARY KEY,
    dono VARCHAR(200) NOT NULL,
    nome VARCHAR(200) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    dados JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_abrigos_dono (dono)
);

CREATE TABLE IF NOT EXISTS necessidades (
    id VARCHAR(64) PRIMARY KEY,
    criado_por VARCHAR(200) NOT NULL,
    abrigo_id VARCHAR(64) NULL,
    dados JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_necessidades_abrigo (abrigo_id)
);

CREATE TABLE IF NOT EXISTS doacoes (
    id VARCHAR(64) PRIMARY KEY,
    conta VARCHAR(200) NOT NULL,
    dados JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_doacoes_conta (conta)
);

CREATE TABLE IF NOT EXISTS compromissos (
    id VARCHAR(64) PRIMARY KEY,
    conta VARCHAR(200) NOT NULL,
    dados JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME DEFAULT NULL,
    INDEX idx_compromissos_conta (conta)
);

-- O mapa precisa da foto sem enviar sessão, por isso ela é servida por um endereço
-- público com id aleatório.
CREATE TABLE IF NOT EXISTS arquivos (
    id CHAR(32) PRIMARY KEY,
    dono VARCHAR(200) NOT NULL,
    mime VARCHAR(40) NOT NULL,
    dados MEDIUMBLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_arquivos_dono (dono)
);
