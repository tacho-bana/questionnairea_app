-- =================================================
-- アンケート調査プラットフォーム データベースセットアップ
-- 統合SQLファイル
-- =================================================

-- =================================================
-- 1. 基本テーブル作成
-- =================================================

-- ユーザー管理
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT false,
    gender VARCHAR,
    birth_date DATE,
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- カテゴリ
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    description TEXT
);

-- アンケート
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id),
    title VARCHAR NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    reward_points INTEGER NOT NULL,
    total_budget INTEGER NOT NULL, -- 総予算（消費ポイント数）
    max_responses INTEGER NOT NULL, -- 集めたい人数
    current_responses INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'active', -- active, paused, closed, expired, completed
    deadline TIMESTAMP WITH TIME ZONE, -- 締切日
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- アンケート質問
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR NOT NULL, -- multiple_choice, text, rating, etc.
    options JSONB, -- 選択肢データ
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL
);

-- アンケート回答
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id),
    respondent_id UUID REFERENCES users(id),
    responses JSONB NOT NULL, -- 回答データ
    quality_score FLOAT, -- Gemini APIによる品質スコア
    is_approved BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_id, respondent_id) -- 重複回答防止
);

-- 個別回答管理（詳細な回答データ）
CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE,
    respondent_id UUID REFERENCES users(id),
    answer_text TEXT,
    answer_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ポイント取引履歴
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount INTEGER NOT NULL, -- 正数=獲得、負数=消費
    transaction_type VARCHAR NOT NULL, -- survey_reward, survey_creation, data_purchase, event_entry, notification_reward
    related_id UUID, -- 関連するsurvey_id等
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 抽選イベント
CREATE TABLE IF NOT EXISTS lottery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description TEXT,
    entry_cost INTEGER NOT NULL,
    prize_description TEXT,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR DEFAULT 'active'
);

-- 抽選参加
CREATE TABLE IF NOT EXISTS lottery_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES lottery_events(id),
    user_id UUID REFERENCES users(id),
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- 通報システム
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reported_content_type VARCHAR NOT NULL, -- survey, response, user
    reported_content_id UUID,
    reason VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================
-- 2. データマーケット機能
-- =================================================

-- データマーケット出品情報
CREATE TABLE IF NOT EXISTS data_market_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_type VARCHAR(10) DEFAULT 'paid' CHECK (price_type IN ('free', 'paid')),
    price INTEGER DEFAULT 0, -- 0円の場合は無料
    revenue_per_sale INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- データ購入履歴
CREATE TABLE IF NOT EXISTS data_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES data_market_listings(id),
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    price INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================
-- 3. お知らせ機能
-- =================================================

-- notifications テーブル: システムからのお知らせ
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')), -- お知らせの種類
  is_global BOOLEAN DEFAULT true, -- 全ユーザー向けかどうか
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- 特定ユーザー向けの場合
  is_active BOOLEAN DEFAULT true,
  reward_points INTEGER DEFAULT 0,
  max_claims INTEGER DEFAULT NULL, -- 最大受け取り人数制限
  current_claims INTEGER DEFAULT 0, -- 現在の受け取り人数
  claim_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- 受け取り期限
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- user_notification_reads テーブル: ユーザーの既読状態
CREATE TABLE IF NOT EXISTS user_notification_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_notification UNIQUE(user_id, notification_id)
);

-- ポイント受け取り履歴テーブル
CREATE TABLE IF NOT EXISTS notification_point_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_claimed INTEGER NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_notification_claim UNIQUE(user_id, notification_id)
);

-- =================================================
-- 4. インデックス作成
-- =================================================

-- 基本テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_surveys_creator_id ON surveys(creator_id);
CREATE INDEX IF NOT EXISTS idx_surveys_category_id ON surveys(category_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_deadline ON surveys(deadline);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent_id ON survey_responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);

-- データマーケットのインデックス
CREATE INDEX IF NOT EXISTS idx_data_market_listings_seller_id ON data_market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_data_market_listings_survey_id ON data_market_listings(survey_id);
CREATE INDEX IF NOT EXISTS idx_data_market_listings_is_active ON data_market_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_data_purchases_buyer_id ON data_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_data_purchases_seller_id ON data_purchases(seller_id);
CREATE INDEX IF NOT EXISTS idx_data_purchases_listing_id ON data_purchases(listing_id);

-- お知らせ機能のインデックス
CREATE INDEX IF NOT EXISTS idx_notifications_is_active ON notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_user_id ON user_notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_notification_id ON user_notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_point_claims_user_id ON notification_point_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_point_claims_notification_id ON notification_point_claims(notification_id);

-- =================================================
-- 5. 関数とストアドプロシージャ
-- =================================================

-- ユーザーポイント安全増減関数
CREATE OR REPLACE FUNCTION increment_user_points(target_user_id UUID, points_delta INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_points INTEGER;
    new_points INTEGER;
BEGIN
    -- 現在のポイント数を取得
    SELECT points INTO current_points
    FROM users
    WHERE id = target_user_id;
    
    -- ユーザーが存在しない場合
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', target_user_id;
    END IF;
    
    -- 新しいポイント数を計算
    new_points := current_points + points_delta;
    
    -- ポイントが負になる場合はエラー
    IF new_points < 0 THEN
        RAISE EXCEPTION 'Insufficient points. Current: %, Requested: %', current_points, points_delta;
    END IF;
    
    -- ポイント更新
    UPDATE users
    SET points = new_points,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 初期ポイント設定関数
CREATE OR REPLACE FUNCTION set_initial_points()
RETURNS TRIGGER AS $$
BEGIN
    NEW.points := 100; -- 初期ポイント100
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 新規ユーザー処理関数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, points)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        100
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- アンケート回答数更新関数
CREATE OR REPLACE FUNCTION increment_survey_responses()
RETURNS TRIGGER AS $$
BEGIN
    -- アンケートの回答数を増加
    UPDATE surveys
    SET current_responses = current_responses + 1
    WHERE id = NEW.survey_id;
    
    -- 目標回答数に達したかチェック
    PERFORM check_survey_completion(NEW.survey_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- アンケート完了チェック関数
CREATE OR REPLACE FUNCTION check_survey_completion(survey_uuid UUID)
RETURNS VOID AS $$
DECLARE
    survey_record RECORD;
BEGIN
    SELECT id, current_responses, max_responses, status
    INTO survey_record
    FROM surveys
    WHERE id = survey_uuid;
    
    -- 目標回答数に達した場合
    IF survey_record.current_responses >= survey_record.max_responses AND survey_record.status = 'active' THEN
        UPDATE surveys
        SET status = 'completed'
        WHERE id = survey_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 期限切れアンケート処理関数
CREATE OR REPLACE FUNCTION process_expired_surveys()
RETURNS INTEGER AS $$
DECLARE
    expired_survey RECORD;
    refund_amount INTEGER;
    total_processed INTEGER := 0;
BEGIN
    -- 期限切れのアクティブなアンケートを取得
    FOR expired_survey IN
        SELECT id, creator_id, total_budget, current_responses, max_responses, reward_points
        FROM surveys
        WHERE status = 'active'
        AND deadline < NOW()
    LOOP
        -- 未使用分のポイントを計算
        refund_amount := (expired_survey.max_responses - expired_survey.current_responses) * expired_survey.reward_points;
        
        IF refund_amount > 0 THEN
            -- 作成者にポイントを返金
            PERFORM increment_user_points(expired_survey.creator_id, refund_amount);
            
            -- 取引履歴に記録
            INSERT INTO point_transactions (user_id, amount, transaction_type, related_id, description)
            VALUES (
                expired_survey.creator_id,
                refund_amount,
                'survey_refund',
                expired_survey.id,
                'アンケート期限切れによる返金'
            );
        END IF;
        
        -- ステータスを期限切れに変更
        UPDATE surveys
        SET status = 'expired'
        WHERE id = expired_survey.id;
        
        total_processed := total_processed + 1;
    END LOOP;
    
    RETURN total_processed;
END;
$$ LANGUAGE plpgsql;

-- データマーケット売上更新関数
CREATE OR REPLACE FUNCTION update_listing_sales()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE data_market_listings
    SET 
        total_sales = total_sales + 1,
        total_revenue = total_revenue + NEW.price,
        updated_at = NOW()
    WHERE id = NEW.listing_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 出品取消し関数
CREATE OR REPLACE FUNCTION cancel_listing(listing_uuid UUID, user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    listing_record RECORD;
BEGIN
    -- 出品情報を取得
    SELECT id, seller_id, is_active, title
    INTO listing_record
    FROM data_market_listings
    WHERE id = listing_uuid;
    
    -- 出品が存在しない場合
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Listing not found');
    END IF;
    
    -- 権限チェック：出品者本人でない場合
    IF listing_record.seller_id != user_uuid THEN
        RETURN json_build_object('success', false, 'error', 'You can only cancel your own listings');
    END IF;
    
    -- 既に非アクティブの場合
    IF NOT listing_record.is_active THEN
        RETURN json_build_object('success', false, 'error', 'Listing is already inactive');
    END IF;
    
    -- 出品を非アクティブ化
    UPDATE data_market_listings
    SET is_active = false, updated_at = NOW()
    WHERE id = listing_uuid;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Listing successfully cancelled',
        'listing_title', listing_record.title
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- アンケート回答数正確更新関数
CREATE OR REPLACE FUNCTION update_survey_response_count()
RETURNS TRIGGER AS $$
DECLARE
    actual_count INTEGER;
BEGIN
    -- 実際の回答数をカウント
    SELECT COUNT(DISTINCT respondent_id)
    INTO actual_count
    FROM survey_responses
    WHERE survey_id = COALESCE(NEW.survey_id, OLD.survey_id)
    AND is_approved = true;
    
    -- surveysテーブルの回答数を更新
    UPDATE surveys
    SET current_responses = actual_count
    WHERE id = COALESCE(NEW.survey_id, OLD.survey_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ポイント受け取り処理の関数
CREATE OR REPLACE FUNCTION claim_notification_points(
  p_notification_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_notification RECORD;
  v_existing_claim RECORD;
  v_points INTEGER;
  v_result JSON;
BEGIN
  -- お知らせ情報を取得
  SELECT * INTO v_notification 
  FROM notifications 
  WHERE id = p_notification_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Notification not found or inactive');
  END IF;
  
  -- ポイントがない場合
  IF v_notification.reward_points <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No points available for this notification');
  END IF;
  
  -- 期限チェック
  IF v_notification.claim_deadline IS NOT NULL AND NOW() > v_notification.claim_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Claim deadline has passed');
  END IF;
  
  -- 受け取り上限チェック
  IF v_notification.max_claims IS NOT NULL AND v_notification.current_claims >= v_notification.max_claims THEN
    RETURN json_build_object('success', false, 'error', 'Maximum claims reached');
  END IF;
  
  -- 既に受け取り済みかチェック
  SELECT * INTO v_existing_claim
  FROM notification_point_claims
  WHERE notification_id = p_notification_id AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Points already claimed');
  END IF;
  
  v_points := v_notification.reward_points;
  
  -- ポイント受け取り履歴を記録
  INSERT INTO notification_point_claims (notification_id, user_id, points_claimed)
  VALUES (p_notification_id, p_user_id, v_points);
  
  -- ユーザーのポイントを更新
  PERFORM increment_user_points(p_user_id, v_points);
  
  -- ポイント取引履歴を記録
  INSERT INTO point_transactions (user_id, amount, transaction_type, related_id, description)
  VALUES (p_user_id, v_points, 'notification_reward', p_notification_id, 
          'お知らせ特典: ' || v_notification.title);
  
  -- お知らせの受け取り人数を更新
  UPDATE notifications 
  SET current_claims = current_claims + 1
  WHERE id = p_notification_id;
  
  v_result := json_build_object(
    'success', true, 
    'points_claimed', v_points,
    'message', 'Points successfully claimed'
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================
-- 6. トリガー設定
-- =================================================

-- 新規ユーザー作成時の初期ポイント設定
DROP TRIGGER IF EXISTS set_initial_points_trigger ON users;
CREATE TRIGGER set_initial_points_trigger
    BEFORE INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION set_initial_points();

-- 認証ユーザー作成時の連携
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- アンケート回答時の回答数更新
DROP TRIGGER IF EXISTS increment_responses_trigger ON survey_responses;
CREATE TRIGGER increment_responses_trigger
    AFTER INSERT ON survey_responses
    FOR EACH ROW EXECUTE FUNCTION increment_survey_responses();

-- データ購入時の売上更新
DROP TRIGGER IF EXISTS update_sales_trigger ON data_purchases;
CREATE TRIGGER update_sales_trigger
    AFTER INSERT ON data_purchases
    FOR EACH ROW EXECUTE FUNCTION update_listing_sales();

-- アンケート回答の正確な数更新
DROP TRIGGER IF EXISTS update_response_count_trigger ON survey_responses;
CREATE TRIGGER update_response_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON survey_responses
    FOR EACH ROW EXECUTE FUNCTION update_survey_response_count();

-- =================================================
-- 7. Row Level Security (RLS) 設定
-- =================================================

-- 全テーブルでRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_point_claims ENABLE ROW LEVEL SECURITY;

-- Users テーブルのRLSポリシー
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Categories テーブルのRLSポリシー
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);

-- Surveys テーブルのRLSポリシー
CREATE POLICY "Anyone can view active surveys" ON surveys FOR SELECT USING (status = 'active');
CREATE POLICY "Users can create surveys" ON surveys FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update own surveys" ON surveys FOR UPDATE USING (auth.uid() = creator_id);

-- Survey Questions テーブルのRLSポリシー
CREATE POLICY "Users can view survey questions" ON survey_questions FOR SELECT USING (true);
CREATE POLICY "Survey creators can manage questions" ON survey_questions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND creator_id = auth.uid())
);
CREATE POLICY "Survey creators can update questions" ON survey_questions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND creator_id = auth.uid())
);
CREATE POLICY "Survey creators can delete questions" ON survey_questions FOR DELETE USING (
    EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND creator_id = auth.uid())
);

-- Survey Responses テーブルのRLSポリシー
CREATE POLICY "Users can view own responses" ON survey_responses FOR SELECT USING (auth.uid() = respondent_id);
CREATE POLICY "Survey creators can view responses" ON survey_responses FOR SELECT USING (
    EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND creator_id = auth.uid())
);
CREATE POLICY "Users can create responses" ON survey_responses FOR INSERT WITH CHECK (auth.uid() = respondent_id);

-- Survey Answers テーブルのRLSポリシー
CREATE POLICY "Users can view own answers" ON survey_answers FOR SELECT USING (auth.uid() = respondent_id);
CREATE POLICY "Survey creators can view answers" ON survey_answers FOR SELECT USING (
    EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND creator_id = auth.uid())
);
CREATE POLICY "Users can create answers" ON survey_answers FOR INSERT WITH CHECK (auth.uid() = respondent_id);

-- Point Transactions テーブルのRLSポリシー
CREATE POLICY "Users can view own transactions" ON point_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create transactions" ON point_transactions FOR INSERT WITH CHECK (true);

-- Lottery Events テーブルのRLSポリシー
CREATE POLICY "Anyone can view active lottery events" ON lottery_events FOR SELECT USING (status = 'active');

-- Lottery Entries テーブルのRLSポリシー
CREATE POLICY "Users can view own entries" ON lottery_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create entries" ON lottery_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports テーブルのRLSポリシー
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Data Market Listings テーブルのRLSポリシー
CREATE POLICY "Anyone can view active listings" ON data_market_listings FOR SELECT USING (is_active = true);
CREATE POLICY "Users can create listings" ON data_market_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update own listings" ON data_market_listings FOR UPDATE USING (auth.uid() = seller_id);

-- Data Purchases テーブルのRLSポリシー
CREATE POLICY "Users can view own purchases" ON data_purchases FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can view their sales" ON data_purchases FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Users can create purchases" ON data_purchases FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Notifications テーブルのRLSポリシー
CREATE POLICY "Users can view active notifications" ON notifications
  FOR SELECT USING (is_active = true AND (is_global = true OR target_user_id = auth.uid()));

-- User Notification Reads テーブルのRLSポリシー
CREATE POLICY "Users can view their own reads" ON user_notification_reads
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own reads" ON user_notification_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own reads" ON user_notification_reads
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notification Point Claims テーブルのRLSポリシー
CREATE POLICY "Users can view their own claims" ON notification_point_claims
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own claims" ON notification_point_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =================================================
-- 8. 初期データ投入
-- =================================================

-- 初期カテゴリデータ
INSERT INTO categories (name, slug, description) VALUES
('学習・教育', 'education', '学習方法や教育に関するアンケート'),
('ライフスタイル', 'lifestyle', '日常生活や趣味に関するアンケート'),
('テクノロジー', 'technology', 'ITやテクノロジーに関するアンケート'),
('エンターテインメント', 'entertainment', '映画、音楽、ゲームなどに関するアンケート'),
('健康・美容', 'health', '健康管理や美容に関するアンケート'),
('その他', 'others', 'その他のトピックに関するアンケート')
ON CONFLICT (slug) DO NOTHING;

-- 初期抽選イベントデータ
INSERT INTO lottery_events (title, description, entry_cost, prize_description, max_participants, end_date) VALUES
('Amazonギフト券プレゼント', '1000円分のAmazonギフト券をプレゼント！', 100, 'Amazonギフト券1000円分', 100, NOW() + INTERVAL '30 days'),
('Apple製品抽選', '最新のAirPodsが当たるチャンス！', 500, 'Apple AirPods Pro', 50, NOW() + INTERVAL '14 days')
ON CONFLICT DO NOTHING;

-- サンプルお知らせデータ
INSERT INTO notifications (title, content, type, is_global, reward_points, max_claims, claim_deadline) VALUES
('🎉 サービス開始のお知らせ', 'アンケート調査プラットフォームがスタートしました！多くの方にご参加いただき、ありがとうございます。', 'success', true, 500, 100, NOW() + INTERVAL '7 days'),
('📊 データマーケット機能追加', 'アンケート結果を売買できるデータマーケット機能が追加されました。ぜひご活用ください！', 'info', true, 100, NULL, NULL),
('⚠️ メンテナンスのお知らせ', '2024年8月25日（日）2:00-4:00にシステムメンテナンスを実施予定です。ご利用いただけない時間がございます。', 'warning', true, 0, NULL, NULL),
('🔧 システム改善のお知らせ', 'ユーザビリティ向上のため、各種UIを改善いたしました。', 'info', true, 0, NULL, NULL)
ON CONFLICT DO NOTHING;

-- =================================================
-- データベースセットアップ完了
-- =================================================