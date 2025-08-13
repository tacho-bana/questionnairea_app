# Google認証セットアップガイド

## 1. Google Cloud Console での設定

### OAuth 2.0 クライアント ID の作成
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. **API とサービス** > **認証情報** に移動
4. **認証情報を作成** > **OAuth 2.0 クライアント ID** を選択
5. アプリケーションの種類として **ウェブアプリケーション** を選択
6. **承認済みのリダイレクト URI** に以下を追加：
   - `http://localhost:3000/auth/callback` (開発環境)
   - `https://your-domain.com/auth/callback` (本番環境)

### クライアント情報の取得
- **クライアント ID** と **クライアントシークレット** をメモしておく

## 2. Supabase での設定

### Google OAuth の有効化
1. [Supabase Dashboard](https://app.supabase.com/) にアクセス
2. プロジェクトを選択
3. **Authentication** > **Providers** に移動
4. **Google** プロバイダーを有効にする
5. Google Cloud Console で取得した以下を入力：
   - **Client ID**
   - **Client Secret**

### リダイレクト URL の設定
1. **Authentication** > **URL Configuration** に移動
2. **Redirect URLs** に以下を追加：
   - `http://localhost:3000/auth/callback` (開発環境)
   - `https://your-domain.com/auth/callback` (本番環境)

## 3. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 4. 動作確認

1. アプリケーションを起動：`docker-compose up`
2. `http://localhost:3000/auth` にアクセス
3. **Googleアカウントでログイン** ボタンをクリック
4. Google認証画面でログイン
5. ダッシュボードにリダイレクトされることを確認

## 注意事項

- Google Cloud Console の OAuth 同意画面の設定も完了している必要があります
- 本番環境では HTTPS を使用してください
- リダイレクト URL は正確に一致している必要があります