# クイックスタートガイド

最小限の手順でアプリケーションを起動するためのガイドです。

## 必要な準備

- Docker と docker-compose がインストール済み
- Google アカウント
- Supabase アカウント

## 5分で起動する手順

### 1. Supabase プロジェクト作成 (2分)

1. [Supabase](https://app.supabase.com/) でプロジェクト作成
2. **SQL Editor** で以下を実行:

```sql
-- コピー&ペーストして実行
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 100,
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    description TEXT
);

INSERT INTO categories (name, slug, description) VALUES
('学習・教育', 'education', '学習方法や教育に関するアンケート'),
('ライフスタイル', 'lifestyle', '日常生活や趣味に関するアンケート'),
('テクノロジー', 'technology', 'ITやテクノロジーに関するアンケート');
```

### 2. Google OAuth 設定 (2分)

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. **API とサービス** > **認証情報** > **OAuth 2.0 クライアント ID** 作成
3. リダイレクト URI に追加: `http://localhost:3000/auth/callback`
4. Supabase の **Authentication** > **Providers** で Google 有効化
5. クライアント ID とシークレットを入力

### 3. 環境変数設定 (1分)

**A. ルート `.env` ファイルを作成:**

```env
# Supabase Settings (Settings > API から取得)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Gemini API (オプション)
GEMINI_API_KEY=your-gemini-api-key
```

**B. `frontend/.env.local` ファイルを作成:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

**C. `backend/.env` ファイルを作成:**

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 4. 起動 (30秒)

```bash
docker-compose up --build
```

### 5. アクセス確認

- http://localhost:3000 にアクセス
- Google認証でログイン
- ダッシュボードが表示されれば成功！

## もしエラーが出たら

```bash
# ログを確認
docker-compose logs

# 再起動
docker-compose down
docker-compose up --build
```

## 最低限必要なURL設定

Google Cloud Console:
- **承認済みのリダイレクト URI**: `http://localhost:3000/auth/callback`

Supabase Authentication:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/callback`

これで基本的な動作確認ができます！