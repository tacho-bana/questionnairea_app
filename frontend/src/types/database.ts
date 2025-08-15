export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string | null
          points: number
          reputation_score: number
          is_banned: boolean
          gender: string | null
          birth_date: string | null
          profile_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          username?: string | null
          points?: number
          reputation_score?: number
          is_banned?: boolean
          gender?: string | null
          birth_date?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          points?: number
          reputation_score?: number
          is_banned?: boolean
          gender?: string | null
          birth_date?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          slug: string
          description: string | null
        }
      }
      surveys: {
        Row: {
          id: string
          creator_id: string
          title: string
          description: string | null
          category_id: number
          reward_points: number
          total_budget: number
          max_responses: number | null
          current_responses: number
          status: string
          is_data_for_sale: boolean
          data_price: number
          created_at: string
        }
      }
      survey_questions: {
        Row: {
          id: string
          survey_id: string
          question_text: string
          question_type: string
          options: any
          is_required: boolean
          order_index: number
        }
      }
      survey_responses: {
        Row: {
          id: string
          survey_id: string
          respondent_id: string
          responses: any
          quality_score: number | null
          is_approved: boolean
          respondent_gender: string | null
          respondent_age: number | null
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          respondent_id: string
          responses: any
          quality_score?: number | null
          is_approved?: boolean
          respondent_gender?: string | null
          respondent_age?: number | null
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          respondent_id?: string
          responses?: any
          quality_score?: number | null
          is_approved?: boolean
          respondent_gender?: string | null
          respondent_age?: number | null
          submitted_at?: string
          created_at?: string
        }
      }
      point_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          transaction_type: string
          related_id: string | null
          description: string | null
          created_at: string
        }
      }
      lottery_events: {
        Row: {
          id: string
          title: string
          description: string | null
          entry_cost: number
          prize_description: string | null
          max_participants: number | null
          current_participants: number
          end_date: string
          status: string
        }
      }
      lottery_entries: {
        Row: {
          id: string
          event_id: string
          user_id: string
          entered_at: string
        }
      }
    }
  }
}