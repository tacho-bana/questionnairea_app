-- デバッグ用: 現在のアンケートと回答の状況を確認
SELECT 
    s.id as survey_id,
    s.title,
    s.current_responses,
    s.max_responses,
    s.creator_id,
    COUNT(sr.id) as actual_responses
FROM surveys s
LEFT JOIN survey_responses sr ON s.id = sr.survey_id
GROUP BY s.id, s.title, s.current_responses, s.max_responses, s.creator_id
ORDER BY s.created_at DESC;

-- 手動でcurrent_responsesを正しい値に更新
UPDATE surveys 
SET current_responses = (
    SELECT COUNT(*) 
    FROM survey_responses 
    WHERE survey_responses.survey_id = surveys.id
);

-- 回答の詳細を確認
SELECT 
    sr.id,
    sr.survey_id,
    sr.respondent_id,
    sr.responses,
    sr.submitted_at,
    s.title as survey_title
FROM survey_responses sr
JOIN surveys s ON sr.survey_id = s.id
ORDER BY sr.submitted_at DESC
LIMIT 10;