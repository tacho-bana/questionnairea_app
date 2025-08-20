-- 現在のRLSポリシーを確認
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'data_market_listings';

-- 既存のポリシーを強制削除して再作成
DROP POLICY IF EXISTS "Users can update their own listings" ON data_market_listings;

-- 新しいポリシーを作成（UPDATEに必要な両方の条件を指定）
CREATE POLICY "Users can update their own listings" ON data_market_listings
  FOR UPDATE 
  USING (seller_id = auth.uid()) 
  WITH CHECK (seller_id = auth.uid());

-- 確認のため再度ポリシーを表示
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'data_market_listings' AND policyname = 'Users can update their own listings';