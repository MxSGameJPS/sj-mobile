Remoção de chaves sensíveis e boas práticas

O que foi feito (rápido):

- `google-services.json` e `eas.json` foram adicionados ao `.gitignore` e removidos do índice Git (não aparecem mais no último commit).

Por que isso pode não ser suficiente:

- O GitHub ainda pode sinalizar chaves que existiram no histórico do repositório. Para limpar totalmente, é necessário reescrever o histórico e forçar um push.

Opções para limpeza definitiva (escolha uma):

1. Usando `git filter-repo` (recomendado)

- Instale: https://github.com/newren/git-filter-repo
- Comandos (execute em `mobile`):

```bash
# remover arquivos específicos do histórico
git filter-repo --path google-services.json --path eas.json --invert-paths

# forçar push para origin (coordenar com a equipe antes)
git push --force --all
git push --force --tags
```

2. Usando BFG Repo-Cleaner (alternativa simples)

- Instale: https://rtyley.github.io/bfg-repo-cleaner/
- Exemplo:

```bash
# faça um clone espelho do repositório
git clone --mirror <repo-url> repo.git
cd repo.git
# remova arquivos
bfg --delete-files google-services.json
bfg --delete-files eas.json
# atualize refs e force push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

Após reescrever o histórico:

- Avise a equipe para resetar os clones locais (reclone ou `git fetch` + `git reset --hard origin/main`).
- Revogue quaisquer credenciais que tenham sido expostas (projetos Firebase/Google/OneSignal/etc.).

Boas práticas daqui pra frente:

- Mantenha arquivos de configuração sensíveis fora do repositório, use variáveis de ambiente ou serviços secretos (e.g., GitHub Secrets, Expo Secrets, Secret Manager).
- Adicione um arquivo de exemplo `env.sample` sem valores reais.

Se quiser, eu posso:

- Executar a reescrita do histórico por você (faço o backup local e reescrevo, mas requer `force push` que impacta colaboradores), ou
- Gerar `env.sample` e instruções para migrar valores sensíveis para variáveis de ambiente.

Digite qual opção prefere: `limpar-historico` ou `apenas-ignorar-e-documented`.
