-- 期限切れアンケート処理とポイント返金システム

-- 期限切れアンケートをチェックして処理する関数
CREATE OR REPLACE FUNCTION process_expired_surveys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    survey_record RECORD;
    refund_amount INTEGER;
BEGIN
    -- 期限切れのアクティブなアンケートを検索
    FOR survey_record IN
        SELECT id, creator_id, total_budget, current_responses, max_responses, title
        FROM surveys
        WHERE deadline < NOW()
        AND status = 'active'
    LOOP
        -- 未使用ポイントを計算
        refund_amount := survey_record.total_budget - (survey_record.current_responses * (survey_record.total_budget / survey_record.max_responses));
        
        -- アンケートステータスを期限切れに更新
        UPDATE surveys 
        SET status = 'expired'
        WHERE id = survey_record.id;
        
        -- 返金が必要な場合
        IF refund_amount > 0 THEN
            -- ユーザーポイントに返金
            UPDATE users 
            SET points = points + refund_amount,
                updated_at = NOW()
            WHERE id = survey_record.creator_id;
            
            -- 返金取引を記録
            INSERT INTO point_transactions (
                user_id,
                amount,
                transaction_type,
                related_id,
                description,
                created_at
            ) VALUES (
                survey_record.creator_id,
                refund_amount,
                'survey_refund',
                survey_record.id,
                CONCAT('期限切れ返金: ', survey_record.title),
                NOW()
            );
        END IF;
        
        -- ログ出力（オプション）
        RAISE NOTICE 'Survey % expired. Refunded % points to user %', 
            survey_record.id, refund_amount, survey_record.creator_id;
    END LOOP;
END;
$$;

-- 期限切れアンケートの自動処理（手動実行用）
-- 実際の運用では、cron jobやScheduled functionで定期実行する
-- SELECT process_expired_surveys();

-- アンケートが目標達成した場合に自動でステータスを変更する関数
CREATE OR REPLACE FUNCTION check_survey_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 目標回答数に達した場合、ステータスをclosedに変更
    IF NEW.current_responses >= NEW.max_responses THEN
        NEW.status := 'closed';
    END IF;
    
    RETURN NEW;
END;
$$;

-- survey_responsesテーブルにトリガーを設定
-- 新しい回答が追加されたときに surveys テーブルの current_responses を更新
CREATE OR REPLACE FUNCTION increment_survey_responses()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 回答数をインクリメント
    UPDATE surveys 
    SET current_responses = current_responses + 1
    WHERE id = NEW.survey_id;
    
    RETURN NEW;
END;
$$;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_increment_responses ON survey_responses;
CREATE TRIGGER trigger_increment_responses
    AFTER INSERT ON survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION increment_survey_responses();

DROP TRIGGER IF EXISTS trigger_check_completion ON surveys;
CREATE TRIGGER trigger_check_completion
    BEFORE UPDATE ON surveys
    FOR EACH ROW
    EXECUTE FUNCTION check_survey_completion();