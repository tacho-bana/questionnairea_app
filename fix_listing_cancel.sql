-- 出品取消し用のRPC関数を作成
CREATE OR REPLACE FUNCTION cancel_listing(listing_id UUID)
RETURNS void AS $$
BEGIN
  -- 呼び出し元が出品者かチェック
  IF NOT EXISTS (
    SELECT 1 FROM data_market_listings 
    WHERE id = listing_id AND seller_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only cancel your own listings';
  END IF;
  
  -- 出品を非アクティブに設定
  UPDATE data_market_listings 
  SET 
    is_active = false,
    updated_at = NOW()
  WHERE id = listing_id AND seller_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found or permission denied';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLSポリシーを再度確認・修正
DROP POLICY IF EXISTS "Users can update their own listings" ON data_market_listings;

CREATE POLICY "Users can update their own listings" ON data_market_listings
  FOR UPDATE 
  USING (seller_id = auth.uid()) 
  WITH CHECK (seller_id = auth.uid());