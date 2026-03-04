# Como corrigir o 404 na aba Empréstimos

O erro **404 (Not Found)** ou **"Could not find the table 'public.loans' in the schema cache"** acontece quando as tabelas de empréstimos não existem no banco ou quando a API REST do Supabase ainda não atualizou o cache do schema. Siga os passos abaixo.

## Passo a passo (Supabase Dashboard)

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard) e entre no projeto do app (URL que contém `hwiucichjrwtvmojpcko`).

2. No menu da esquerda, clique em **SQL Editor**.

3. Clique em **New query**.

4. Abra o arquivo **`migrations/022_loans.sql`** neste projeto, copie **todo** o conteúdo (Ctrl+A, Ctrl+C).

5. Cole no editor do SQL Editor (Ctrl+V) e clique em **Run** (ou use Ctrl+Enter).

6. Confirme que a execução terminou **sem erros** (mensagem verde “Success”).

7. **Se aparecer “Could not find the table 'public.loans' in the schema cache”** no app:
   - No SQL Editor, abra **`reload_schema_cache.sql`**, copie o conteúdo, cole em uma **nova query** e clique em **Run**.
   - Ou espere 1–2 minutos e atualize a página do app (F5).

8. No app, atualize a página (F5) e tente de novo **Solicitar empréstimo**.

## Se der erro ao rodar o SQL

- **"relation public.profiles does not exist"**  
  O projeto usa outra tabela de perfis. Avise qual é o nome da tabela (e do campo de setor/department) para adaptarmos o SQL.

- **"permission denied for schema storage"**  
  Crie primeiro só as tabelas e as políticas RLS (até a linha 84 do `022_loans.sql`). Depois crie o bucket **loan-attachments** manualmente em **Storage** no Dashboard e, se quiser, peça as políticas de Storage em um segundo script.

Depois de rodar o SQL com sucesso, a API em **/rest/v1/loans** passa a existir e o 404 deixa de aparecer.
