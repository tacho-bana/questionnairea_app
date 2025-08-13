# Supabase RLS (Row Level Security) セットアップ

## エラーの原因

```
GET .../rest/v1/users?select=*&id=eq.xxx 406 (Not Acceptable)
```

このエラーは**Row Level Security (RLS)** が有効になっているため、認証されていないリクエストが拒否されることが原因です。

## 解決手順

### 1. Supabase ダッシュボードでRLSポリシーを設定

1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択
3. **SQL Editor** に移動
4. `supabase_rls_policies.sql` の内容をコピー&ペースト
5. **RUN** をクリックして実行

### 2. 設定されるポリシー

#### Users テーブル
- ✅ ユーザーは自分のプロフィールのみ閲覧・更新可能
- ✅ 認証済みユーザーのみ新規作成可能

#### Categories テーブル
- ✅ 誰でも閲覧可能（公開情報）

#### Surveys テーブル
- ✅ アクティブなアンケートは誰でも閲覧可能
- ✅ ユーザーは自分のアンケートのみ作成・更新可能

#### その他のテーブル
- ✅ 適切な権限管理でセキュリティを確保

## 3. 確認方法

RLSポリシーが正しく設定されたか確認：

```sql
-- ポリシー一覧を表示
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 4. 代替解決法（一時的）

**注意: セキュリティ上推奨されません**

RLSを無効にする場合（開発初期段階のみ）：

```sql
-- 一時的にRLSを無効化（本番環境では使用禁止）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
-- 他のテーブルも同様
```

## 5. 動作確認

1. RLSポリシーを設定
2. フロントエンドでGoogle認証
3. ダッシュボードにアクセス
4. ユーザー情報が正常に表示されることを確認

## セキュリティ上の利点

✅ **不正アクセス防止**: 認証されていないユーザーはデータにアクセス不可  
✅ **データ分離**: ユーザーは自分のデータのみアクセス可能  
✅ **API レベル保護**: REST API、GraphQL両方で自動適用  
✅ **管理者権限**: 必要に応じて管理者ポリシーを追加可能

## トラブルシューティング

### ポリシーが効かない場合
1. **RLSが有効**になっているか確認
2. **認証トークン**が正しく送信されているか確認
3. **ポリシーの条件**が正しいか確認

### 開発中にアクセスできない場合
一時的にサービスロールキーを使用（本番では使用禁止）：

```typescript
// 開発環境のみ - サービスロールキー使用
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 危険：本番で使用禁止
)
```