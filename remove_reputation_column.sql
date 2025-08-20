-- 信頼度機能を削除
-- usersテーブルからreputation_scoreカラムを削除

ALTER TABLE users DROP COLUMN IF EXISTS reputation_score;