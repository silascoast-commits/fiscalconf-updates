# FiscalConf — Instalador Windows

## Como gerar o instalador .exe para Windows

### Pré-requisitos (máquina de build — Linux/Mac/Windows com Node.js 18+)

```bash
npm install
npm run electron:build:win
```

O instalador gerado estará em:
```
dist-installer/FiscalConf Setup 3.0.0.exe
```

### O que o instalador faz

1. Instala o FiscalConf em `C:\Program Files\FiscalConf` (ou pasta escolhida)
2. Cria atalho na Área de Trabalho e no Menu Iniciar
3. Inclui tudo: servidor Node.js, banco de dados SQLite e interface web

### Dados do usuário

Os dados ficam salvos em:
```
C:\Users\<seu-usuario>\AppData\Roaming\FiscalConf\data.db
```

Não são apagados ao desinstalar (somente se marcar a opção durante desinstalação).

### Funcionamento

- O aplicativo inicia um servidor local na porta **5799**
- Abre automaticamente a interface no Electron (sem precisar de browser)
- Para fechar: feche a janela normalmente

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (browser) |
| `npm run electron:dev` | Electron em modo desenvolvimento |
| `npm run electron:build:win` | Gera instalador Windows (.exe) |
| `npm run electron:build:all` | Gera instaladores Win + Mac + Linux |
