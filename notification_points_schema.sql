-- お知らせにポイント配布機能を追加

-- notificationsテーブルにポイント関連のカラムを追加
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS max_claims INTEGER DEFAULT NULL; -- 最大受け取り人数制限
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS current_claims INTEGER DEFAULT 0; -- 現在の受け取り人数
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS claim_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL; -- 受け取り期限

-- ポイント受け取り履歴テーブル
CREATE TABLE IF NOT EXISTS notification_point_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_claimed INTEGER NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_notification_claim UNIQUE(user_id, notification_id)
);

-- RLS設定
ALTER TABLE notification_point_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own claims" ON notification_point_claims
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own claims" ON notification_point_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- インデックス
CREATE INDEX IF NOT EXISTS idx_notification_point_claims_user_id ON notification_point_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_point_claims_notification_id ON notification_point_claims(notification_id);

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

-- サンプルデータ更新（ポイント配布あり）
UPDATE notifications 
SET reward_points = 500, max_claims = 100, claim_deadline = NOW() + INTERVAL '7 days'
WHERE title LIKE '%サービス開始%';

UPDATE notifications 
SET reward_points = 100
WHERE title LIKE '%データマーケット%';