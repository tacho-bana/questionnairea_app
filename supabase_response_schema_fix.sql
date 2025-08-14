-- survey_answers テーブルを作成（個別の質問回答を管理）
CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- survey_responsesのupdated_at追加
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- current_responses を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE surveys 
        SET current_responses = (
            SELECT COUNT(*) 
            FROM survey_responses 
            WHERE survey_id = NEW.survey_id
        )
        WHERE id = NEW.survey_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE surveys 
        SET current_responses = (
            SELECT COUNT(*) 
            FROM survey_responses 
            WHERE survey_id = OLD.survey_id
        )
        WHERE id = OLD.survey_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
DROP TRIGGER IF EXISTS trigger_update_survey_response_count ON survey_responses;
CREATE TRIGGER trigger_update_survey_response_count
    AFTER INSERT OR DELETE ON survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_response_count();

-- 既存のsurvey_responsesのcurrent_responsesを修正
UPDATE surveys SET current_responses = (
    SELECT COUNT(*)
    FROM survey_responses
    WHERE survey_responses.survey_id = surveys.id
);

-- RLS ポリシーをsurvey_answersに追加
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- survey_answersの読み取りポリシー（アンケート作成者または回答者が見れる）
CREATE POLICY "survey_answers_select_policy" ON survey_answers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM survey_responses sr
            JOIN surveys s ON sr.survey_id = s.id
            WHERE sr.id = survey_answers.response_id
            AND (s.creator_id = auth.uid() OR sr.respondent_id = auth.uid())
        )
    );

-- survey_answersの挿入ポリシー（回答者のみ）
CREATE POLICY "survey_answers_insert_policy" ON survey_answers
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM survey_responses sr
            WHERE sr.id = survey_answers.response_id
            AND sr.respondent_id = auth.uid()
        )
    );

-- survey_answersの削除ポリシー（回答者のみ）
CREATE POLICY "survey_answers_delete_policy" ON survey_answers
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM survey_responses sr
            WHERE sr.id = survey_answers.response_id
            AND sr.respondent_id = auth.uid()
        )
    );