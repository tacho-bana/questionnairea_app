-- RLS Policies Fix for 406 Error
-- SupabaseのSQL Editorで実行してください

-- 既存のポリシーを削除して新しく作成
DROP POLICY IF EXISTS "System can insert transactions" ON point_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON point_transactions;
DROP POLICY IF EXISTS "Survey creators can manage questions" ON survey_questions;

-- Point transactions policies (修正版)
CREATE POLICY "Users can view own transactions" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert transactions" ON point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Survey questions policies (修正版) 
CREATE POLICY "Survey creators can insert questions" ON survey_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_questions.survey_id 
      AND surveys.creator_id = auth.uid()
    )
  );

CREATE POLICY "Survey creators can update questions" ON survey_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_questions.survey_id 
      AND surveys.creator_id = auth.uid()
    )
  );

CREATE POLICY "Survey creators can delete questions" ON survey_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_questions.survey_id 
      AND surveys.creator_id = auth.uid()
    )
  );

-- ポイント管理のためのストアドファンクション用ポリシー
-- increment_user_points関数のためのSECURITY DEFINER設定
CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users 
  SET points = points + amount,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$;

-- RPC関数の実行権限を認証済みユーザーに付与
GRANT EXECUTE ON FUNCTION increment_user_points TO authenticated;