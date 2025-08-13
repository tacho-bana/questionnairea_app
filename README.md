# 学生向けアンケート・ポイント交換プラットフォーム

学生がアンケートに回答してポイントを獲得し、抽選イベントに参加したり、アンケートを作成したりできるプラットフォームです。

## 技術スタック

- **フロントエンド**: Next.js 14 + TypeScript + Tailwind CSS
- **バックエンド**: FastAPI + Python
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth (Google OAuth)
- **コンテナ**: Docker + docker-compose
- **API連携**: Gemini API (アンケート品質チェック)

## 機能一覧

- ✅ Google認証によるログイン/新規登録
- ✅ ダッシュボード（ポイント・統計表示）
- ✅ アンケート一覧（カテゴリ絞り込み・検索）
- 🚧 アンケート回答機能
- 🚧 アンケート作成機能
- 🚧 ポイント経済システム
- 🚧 データマーケット
- 🚧 抽選イベント
- 🚧 データ可視化
- 🚧 管理画面

## セットアップ手順

### 1. リポジトリのクローンと準備

```bash
# リポジトリをクローン
git clone <repository-url>
cd questionnairea_app

# 必要なディレクトリ構成を確認
ls -la
# frontend/  backend/  docker-compose.yml  等が存在することを確認
```

### 2. Supabase プロジェクトの作成

1. [Supabase](https://app.supabase.com/) にアクセスしてアカウント作成
2. **New project** をクリックして新しいプロジェクトを作成
3. プロジェクト名・パスワードを設定して **Create new project** をクリック
4. プロジェクトの準備が完了するまで待機（数分）

### 3. データベーススキーマの作成

1. Supabase ダッシュボードで **SQL Editor** に移動
2. `supabase_schema.sql` ファイルの内容をコピー&ペースト
3. **RUN** ボタンをクリックしてスキーマを作成

```sql
-- supabase_schema.sql の内容を実行
-- ユーザー、カテゴリ、アンケート、抽選イベント等のテーブルが作成される
```

### 4. Row Level Security (RLS) ポリシーの設定

1. 引き続き **SQL Editor** で
2. `supabase_rls_policies.sql` ファイルの内容をコピー&ペースト
3. **RUN** ボタンをクリックしてセキュリティポリシーを設定

```sql
-- supabase_rls_policies.sql の内容を実行
-- データベースのセキュリティポリシーが設定される
```

### 4. Google OAuth の設定

#### 4.1 Google Cloud Console での設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. **API とサービス** > **認証情報** に移動
4. **認証情報を作成** > **OAuth 2.0 クライアント ID** を選択
5. アプリケーションの種類: **ウェブアプリケーション**
6. **承認済みのリダイレクト URI** に追加:
   ```
   http://localhost:3000/auth/callback
   https://<your-supabase-project>.supabase.co/auth/v1/callback
   ```
7. **クライアント ID** と **クライアントシークレット** をメモ

#### 4.2 Supabase での Google OAuth 設定

1. Supabase ダッシュボードで **Authentication** > **Providers** に移動
2. **Google** プロバイダーを有効にする
3. Google Cloud Console で取得した情報を入力:
   - **Client ID**: 取得したクライアントID
   - **Client Secret**: 取得したクライアントシークレット
4. **Save** をクリック

### 5. 環境変数の設定

#### 5.1 Supabase の認証情報を取得

1. Supabase ダッシュボードで **Settings** > **API** に移動
2. 以下の情報をメモ:
   - **Project URL**
   - **anon public** key
   - **service_role** key (バックエンド用)

#### 5.2 環境変数ファイルの作成

**A. ルートディレクトリの環境変数**
```bash
# ルートディレクトリに .env ファイルを作成
cp .env.example .env
```

`.env` ファイルを以下のように編集:

```env
# Supabase Settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Gemini API (後で設定可能)
GEMINI_API_KEY=your-gemini-api-key
```

**B. フロントエンド用環境変数**
```bash
# フロントエンドディレクトリに .env.local ファイルを作成
cd frontend
cp .env.local.example .env.local
```

`frontend/.env.local` ファイルを編集:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

**C. バックエンド用環境変数**
```bash
# バックエンドディレクトリに .env ファイルを作成
cd ../backend
cp .env.example .env
```

`backend/.env` ファイルを編集:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 6. Docker でアプリケーションを起動

```bash
# ルートディレクトリに戻る
cd ..

# Docker コンテナをビルド・起動
docker-compose up --build

# バックグラウンドで起動する場合
docker-compose up -d --build
```

### 7. アプリケーションへのアクセス

起動が完了したら以下のURLにアクセス:

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 動作確認手順

### 1. 基本動作確認

1. http://localhost:3000 にアクセス
2. トップページが表示されることを確認
3. **ログイン / 新規登録** ボタンをクリック
4. Google認証画面が表示されることを確認

### 2. ログイン機能確認

1. **Googleアカウントでログイン** ボタンをクリック
2. Google認証画面でログイン
3. `/dashboard` にリダイレクトされることを確認
4. ダッシュボードに以下が表示されることを確認:
   - ユーザー名
   - 保有ポイント (初期値: 0)
   - 信頼度スコア (初期値: 100)

### 3. ナビゲーション確認

1. ナビゲーションバーに以下のメニューが表示されることを確認:
   - ダッシュボード
   - アンケート一覧
   - アンケート作成
   - データマーケット
   - 抽選イベント
2. 各ページに遷移できることを確認

## トラブルシューティング

### Python依存関係エラーの場合

`ERROR: ResolutionImpossible` が発生した場合:

```bash
# 完全リセットして再試行
docker-compose down --volumes --remove-orphans
docker system prune -f
docker-compose up --build
```

詳細は `DOCKER_TROUBLESHOOTING.md` を参照してください。

### よくある問題

#### 1. Docker コンテナが起動しない

```bash
# コンテナの状態を確認
docker-compose ps

# ログを確認
docker-compose logs

# 特定のサービスのログを確認
docker-compose logs frontend
docker-compose logs backend
```

#### 2. 環境変数が読み込まれない

- `.env` ファイルがルートディレクトリに存在することを確認
- `frontend/.env.local` ファイルが存在することを確認
- 環境変数の値に余計な空白やクォートが入っていないか確認

#### 3. Google認証が失敗する

- Google Cloud Console のリダイレクト URI 設定を確認
- Supabase の Google プロバイダー設定を確認
- ブラウザのキャッシュをクリア

#### 4. データベース接続エラー

- Supabase プロジェクトが正常に作成されているか確認
- データベーススキーマが正しく実行されているか確認
- API キーが正しく設定されているか確認

### ログの確認方法

```bash
# すべてのサービスのログを表示
docker-compose logs -f

# フロントエンドのログのみ
docker-compose logs -f frontend

# バックエンドのログのみ
docker-compose logs -f backend
```

## 開発用コマンド

```bash
# コンテナを停止
docker-compose down

# コンテナを削除して再ビルド
docker-compose down --volumes --remove-orphans
docker-compose up --build

# 個別のサービスを再起動
docker-compose restart frontend
docker-compose restart backend
```

## 次のステップ

基本的な動作確認が完了したら、以下の機能開発を進めることができます:

1. **アンケート回答機能**: 質問の表示と回答送信
2. **アンケート作成機能**: 質問の作成とポイント設定
3. **ポイント経済システム**: ポイントの獲得・消費ロジック
4. **Gemini API 連携**: 回答品質の自動チェック
5. **データ可視化**: 回答結果のグラフ表示
6. **抽選イベント**: ポイント消費による抽選参加

## サポート

問題が発生した場合は、以下を確認してください:

1. Docker と docker-compose がインストールされているか
2. 必要なポートが他のアプリケーションで使用されていないか (3000, 8000)
3. 環境変数が正しく設定されているか
4. Google Cloud Console と Supabase の設定が完了しているか