-- RLSポリシーの修正
-- 既存のUPDATEポリシーを削除して再作成

DROP POLICY IF EXISTS "Users can update their own listings" ON data_market_listings;

CREATE POLICY "Users can update their own listings" ON data_market_listings
  FOR UPDATE USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());