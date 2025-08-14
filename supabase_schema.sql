-- ユーザー管理
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 100,
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- カテゴリ
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    description TEXT
);

-- アンケート
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id),
    title VARCHAR NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    reward_points INTEGER NOT NULL,
    total_budget INTEGER NOT NULL, -- 総予算（消費ポイント数）
    max_responses INTEGER NOT NULL, -- 集めたい人数
    current_responses INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'active', -- active, paused, closed, expired
    is_data_for_sale BOOLEAN DEFAULT false,
    data_price INTEGER DEFAULT 0,
    deadline TIMESTAMP, -- 締切日
    created_at TIMESTAMP DEFAULT NOW()
);

-- アンケート質問
CREATE TABLE survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR NOT NULL, -- multiple_choice, text, rating, etc.
    options JSONB, -- 選択肢データ
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL
);

-- アンケート回答
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id),
    respondent_id UUID REFERENCES users(id),
    responses JSONB NOT NULL, -- 回答データ
    quality_score FLOAT, -- Gemini APIによる品質スコア
    is_approved BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(survey_id, respondent_id) -- 重複回答防止
);

-- ポイント取引履歴
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount INTEGER NOT NULL, -- 正数=獲得、負数=消費
    transaction_type VARCHAR NOT NULL, -- survey_reward, survey_creation, data_purchase, event_entry
    related_id UUID, -- 関連するsurvey_id等
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- データ販売
CREATE TABLE data_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id),
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    price INTEGER NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW()
);

-- 抽選イベント
CREATE TABLE lottery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description TEXT,
    entry_cost INTEGER NOT NULL,
    prize_description TEXT,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    end_date TIMESTAMP NOT NULL,
    status VARCHAR DEFAULT 'active'
);

-- 抽選参加
CREATE TABLE lottery_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES lottery_events(id),
    user_id UUID REFERENCES users(id),
    entered_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- 通報システム
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reported_content_type VARCHAR NOT NULL, -- survey, response, user
    reported_content_id UUID,
    reason VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP DEFAULT NOW()
);

-- 初期カテゴリデータ
INSERT INTO categories (name, slug, description) VALUES
('学習・教育', 'education', '学習方法や教育に関するアンケート'),
('ライフスタイル', 'lifestyle', '日常生活や趣味に関するアンケート'),
('テクノロジー', 'technology', 'ITやテクノロジーに関するアンケート'),
('エンターテインメント', 'entertainment', '映画、音楽、ゲームなどに関するアンケート'),
('健康・美容', 'health', '健康管理や美容に関するアンケート'),
('その他', 'others', 'その他のトピックに関するアンケート');

-- 初期抽選イベントデータ
INSERT INTO lottery_events (title, description, entry_cost, prize_description, max_participants, end_date) VALUES
('Amazonギフト券プレゼント', '1000円分のAmazonギフト券をプレゼント！', 100, 'Amazonギフト券1000円分', 100, NOW() + INTERVAL '30 days'),
('Apple製品抽選', '最新のAirPodsが当たるチャンス！', 500, 'Apple AirPods Pro', 50, NOW() + INTERVAL '14 days');