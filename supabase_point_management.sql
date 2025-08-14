-- ポイント管理用のストアドファンクション

-- ユーザーポイントを安全に増減させる関数
CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ポイントを更新
  UPDATE users 
  SET 
    points = points + amount,
    updated_at = NOW()
  WHERE id = user_id;
  
  -- 更新されない場合（ユーザーが存在しない場合）のエラーハンドリング
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;
  
  -- ポイントが負の値になる場合のエラーハンドリング
  IF (SELECT points FROM users WHERE id = user_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient points. Cannot have negative points.';
  END IF;
END;
$$;

-- RLS ポリシーでストアドファンクションの実行を許可
CREATE POLICY "Allow point updates via function" ON users
  FOR UPDATE USING (true);

-- 初期ポイント設定用の関数
CREATE OR REPLACE FUNCTION set_initial_points(user_id UUID, initial_amount INTEGER DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users 
  SET points = initial_amount
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;
END;
$$;