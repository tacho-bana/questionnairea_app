-- 認証システムとusersテーブルの連携修正
-- SupabaseのSQL Editorで実行してください

-- 1. auth.usersとpublic.usersの連携用トリガー関数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, points, reputation_score)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    0,
    100
  );
  RETURN NEW;
END;
$$;

-- 2. auth.usersにトリガーを設定（新規ユーザー作成時に自動でpublic.usersに追加）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. RLSポリシーを一時的に無効化（問題解決後に再有効化）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

-- 4. 既存の認証済みユーザーがいる場合、手動でusersテーブルに追加
-- ※ 実際の認証済みユーザーのIDとemailに置き換えてください
-- INSERT INTO public.users (id, email, username, points, reputation_score)
-- VALUES (
--   'your-auth-user-id',
--   'your-email@example.com', 
--   'your-username',
--   0,
--   100
-- ) ON CONFLICT (id) DO NOTHING;

-- 5. 必要な権限を付与
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;