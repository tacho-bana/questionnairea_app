-- Row Level Security (RLS) Policies for Questionnaire Platform

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users only" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories table policies (public read)
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

-- Surveys table policies
CREATE POLICY "Anyone can view active surveys" ON surveys
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users can create surveys" ON surveys
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Survey creators can update own surveys" ON surveys
  FOR UPDATE USING (auth.uid() = creator_id);

-- Survey questions policies
CREATE POLICY "Anyone can view questions of active surveys" ON survey_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_questions.survey_id 
      AND surveys.status = 'active'
    )
  );

CREATE POLICY "Survey creators can manage questions" ON survey_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_questions.survey_id 
      AND surveys.creator_id = auth.uid()
    )
  );

-- Survey responses policies
CREATE POLICY "Users can view own responses" ON survey_responses
  FOR SELECT USING (auth.uid() = respondent_id);

CREATE POLICY "Users can insert own responses" ON survey_responses
  FOR INSERT WITH CHECK (auth.uid() = respondent_id);

CREATE POLICY "Survey creators can view responses to their surveys" ON survey_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM surveys 
      WHERE surveys.id = survey_responses.survey_id 
      AND surveys.creator_id = auth.uid()
    )
  );

-- Point transactions policies
CREATE POLICY "Users can view own transactions" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON point_transactions
  FOR INSERT WITH CHECK (true);

-- Data sales policies
CREATE POLICY "Users can view own purchases" ON data_sales
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Users can view own sales" ON data_sales
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Users can create data sales" ON data_sales
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Lottery events policies (public read)
CREATE POLICY "Anyone can view active lottery events" ON lottery_events
  FOR SELECT USING (status = 'active');

-- Lottery entries policies
CREATE POLICY "Users can view own entries" ON lottery_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own entries" ON lottery_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);