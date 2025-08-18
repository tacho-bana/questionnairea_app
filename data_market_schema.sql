-- データマーケット機能用のスキーマ拡張

-- data_market_listings テーブル: データ出品情報
CREATE TABLE IF NOT EXISTS data_market_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_type VARCHAR(20) DEFAULT 'paid' CHECK (price_type IN ('free', 'paid')), -- 価格タイプ
  price INTEGER DEFAULT 1000, -- 有料の場合の価格
  revenue_per_sale INTEGER DEFAULT 100, -- 作成者に入る金額（有料のみ）
  total_sales INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_survey_listing UNIQUE(survey_id)
);

-- data_purchases テーブル: データ購入履歴
CREATE TABLE IF NOT EXISTS data_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES data_market_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_paid INTEGER NOT NULL,
  revenue_to_seller INTEGER NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_buyer_listing UNIQUE(buyer_id, listing_id)
);

-- RLS (Row Level Security) の設定
ALTER TABLE data_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_purchases ENABLE ROW LEVEL SECURITY;

-- data_market_listings のRLSポリシー
CREATE POLICY "Users can view all active listings" ON data_market_listings
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create listings for their surveys" ON data_market_listings
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update their own listings" ON data_market_listings
  FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Users can delete their own listings" ON data_market_listings
  FOR DELETE USING (seller_id = auth.uid());

-- data_purchases のRLSポリシー
CREATE POLICY "Users can view their own purchases" ON data_purchases
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create purchase records" ON data_purchases
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_data_market_listings_survey_id ON data_market_listings(survey_id);
CREATE INDEX IF NOT EXISTS idx_data_market_listings_seller_id ON data_market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_data_market_listings_active ON data_market_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_data_purchases_listing_id ON data_purchases(listing_id);
CREATE INDEX IF NOT EXISTS idx_data_purchases_buyer_id ON data_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_data_purchases_seller_id ON data_purchases(seller_id);

-- 購入時の売上更新関数
CREATE OR REPLACE FUNCTION update_listing_sales(
  listing_id UUID,
  revenue_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE data_market_listings 
  SET 
    total_sales = total_sales + 1,
    total_revenue = total_revenue + revenue_amount,
    updated_at = NOW()
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql;