# Google認証 FAQ

## Google認証にAPIキーは必要？

**いいえ、Google OAuth認証にはAPIキーは不要です。**

### 必要なのは：

1. **Google Cloud Console での設定**
   - OAuth 2.0 クライアント ID
   - クライアントシークレット
   - リダイレクト URI の設定

2. **Supabase での設定**
   - Google プロバイダーの有効化
   - クライアント ID とシークレットの入力

### APIキーが必要なケース

以下のGoogle APIを使用する場合のみAPIキーが必要：

- **Google Maps API**
- **Google Cloud Translation API** 
- **Google Analytics API**
- **YouTube API**
- etc.

## 現在の実装での環境変数

### 必須設定（認証に必要）
```env
# Supabase Settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### オプション設定
```env
# Gemini API (アンケート品質チェック用・後で設定可能)
GEMINI_API_KEY=your-gemini-api-key
```

## Google OAuth の認証フロー

1. **ユーザーが「Googleでログイン」をクリック**
2. **Google の認証画面にリダイレクト**
   - Google Cloud Console で設定したOAuthクライアントを使用
3. **ユーザーがGoogle アカウントでログイン**
4. **Google から承認コードを取得**
5. **Supabase がアクセストークンと交換**
6. **アプリケーションにユーザー情報が返される**

このフローにはAPIキーは不要で、OAuth 2.0 の標準的な認証フローです。

## よくある混同

### ❌ 混同しやすいパターン
- **Google APIs** → APIキーが必要
- **Google OAuth** → APIキー不要（クライアント ID/シークレットのみ）

### ✅ 正しい理解
- **認証（Authentication）** → OAuth 2.0（APIキー不要）
- **API使用（API Access）** → APIキー必要

## トラブルシューティング

### Google認証がうまく動かない場合

1. **Google Cloud Console の設定確認**
   - リダイレクト URI: `http://localhost:3000/auth/callback`
   - OAuth 同意画面の設定完了

2. **Supabase の設定確認**
   - Google プロバイダーが有効
   - クライアント ID/シークレットが正しく入力

3. **環境変数の確認**
   - Supabase の URL と API キーが正しく設定

### デバッグ用ログ確認

```bash
# フロントエンドのログ
docker-compose logs frontend

# ブラウザの開発者ツール
# Console タブでエラーメッセージを確認
```

## まとめ

- **Google OAuth認証**: APIキー不要
- **必要なのは**: OAuth クライアント設定のみ
- **環境変数**: Supabase の設定のみ必須
- **Gemini API**: オプション（後で設定可能）