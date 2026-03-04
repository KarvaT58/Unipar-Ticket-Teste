# Tabelas do banco – Ideias e Ajuda

Resumo das tabelas no Supabase usadas pelas páginas **Ideias** e **Ajuda**.

---

## Página Ideias (`/dashboard/ideias`)

### Tabela: `ideas`

Já existe no seu projeto. Colunas:

| Coluna            | Tipo      | Descrição                          |
|-------------------|-----------|------------------------------------|
| `id`              | uuid      | PK, gerado automaticamente         |
| `content`         | text      | Conteúdo da ideia                  |
| `category`        | text      | Categoria (melhoria, tecnologia…) |
| `status`          | text      | pendente, em_analise, implementado, descartado |
| `admin_response`  | text      | Resposta do admin (opcional)      |
| `created_at`      | timestamptz | Data de criação                 |
| `submitted_by`    | uuid      | Quem enviou (FK para profiles)    |
| `attachment_urls` | text[]    | URLs de anexos (array)            |

**Storage:** bucket `idea-attachments` para anexos das ideias.

---

## Página Ajuda (`/dashboard/ajuda`)

### Tabela: `help_images`

Criada para armazenar as imagens de ajuda (tutoriais, manuais, etc.).

| Coluna      | Tipo        | Descrição                    |
|-------------|-------------|------------------------------|
| `id`        | uuid        | PK, gerado automaticamente   |
| `title`     | text        | Título da imagem            |
| `image_url` | text        | URL da imagem (ex.: Supabase Storage ou link externo) |
| `position`  | integer     | Ordem de exibição (0, 1, 2…) |
| `created_at`| timestamptz | Data de criação              |

**RLS:**
- **SELECT:** qualquer usuário autenticado pode ver as imagens.
- **INSERT / UPDATE / DELETE:** apenas usuários com `profiles.role = 'admin'` ou `profiles.department = 'ADMINISTRAÇÃO'`.

A listagem na página usa `position` e `created_at` para ordenar. Se a tabela estiver vazia, a página mostra imagens de exemplo (placeholders).
