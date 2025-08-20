-- お知らせ機能のスキーマ

-- notifications テーブル: システムからのお知らせ
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')), -- お知らせの種類
  is_global BOOLEAN DEFAULT true, -- 全ユーザー向けかどうか
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- 特定ユーザー向けの場合
  is_active BOOLEAN DEFAULT true,
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

-- RLS (Row Level Security) の設定
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_reads ENABLE ROW LEVEL SECURITY;

-- notifications のRLSポリシー
CREATE POLICY "Users can view active notifications" ON notifications
  FOR SELECT USING (is_active = true AND (is_global = true OR target_user_id = auth.uid()));

-- user_notification_reads のRLSポリシー
CREATE POLICY "Users can view their own reads" ON user_notification_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reads" ON user_notification_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reads" ON user_notification_reads
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_notifications_is_active ON notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_user_id ON user_notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_notification_id ON user_notification_reads(notification_id);

-- サンプルデータの投入
INSERT INTO notifications (title, content, type, is_global) VALUES
('🎉 サービス開始のお知らせ', 'アンケート調査プラットフォームがスタートしました！多くの方にご参加いただき、ありがとうございます。', 'success', true),
('📊 データマーケット機能追加', 'アンケート結果を売買できるデータマーケット機能が追加されました。ぜひご活用ください！', 'info', true),
('⚠️ メンテナンスのお知らせ', '2024年8月25日（日）2:00-4:00にシステムメンテナンスを実施予定です。ご利用いただけない時間がございます。', 'warning', true),
('🔧 システム改善のお知らせ', 'ユーザビリティ向上のため、各種UIを改善いたしました。', 'info', true);