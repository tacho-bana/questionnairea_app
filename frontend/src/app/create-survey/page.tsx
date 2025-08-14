'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import SurveyBuilderSimple, { Question } from '@/components/SurveyBuilderSimple'
import SurveyPreview from '@/components/SurveyPreview'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

export default function CreateSurveyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    total_budget: 1000, // 消費ポイント数
    max_responses: 10, // 集めたい人数
    deadline: '', // 締切日
  })
  
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'question-1',
      question_text: '',
      question_type: 'text',
      options: [],
      is_required: true
    }
  ])
  
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder')

  // 報酬ポイントを自動計算
  const rewardPerResponse = Math.floor(formData.total_budget / formData.max_responses) || 0

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (data) {
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // バリデーション
      if (formData.total_budget < 1000 || formData.total_budget % 100 !== 0) {
        alert('消費ポイント数は1000ポイント以上で100ポイント単位で設定してください')
        return
      }

      if (formData.max_responses < 10 || formData.max_responses % 10 !== 0) {
        alert('集めたい人数は10人以上で10人単位で設定してください')
        return
      }

      if (rewardPerResponse <= 0) {
        alert('1人あたりの報酬が0以下になります。消費ポイント数を増やすか、人数を減らしてください')
        return
      }

      if (!formData.deadline) {
        alert('締切日を設定してください')
        return
      }

      const deadlineDate = new Date(formData.deadline)
      if (deadlineDate <= new Date()) {
        alert('締切日は現在時刻より後に設定してください')
        return
      }

      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert([
          {
            creator_id: user?.id,
            title: formData.title,
            description: formData.description,
            category_id: parseInt(formData.category_id),
            reward_points: rewardPerResponse,
            total_budget: formData.total_budget,
            max_responses: formData.max_responses,
            deadline: formData.deadline,
            status: 'active'
          }
        ])
        .select()
        .single()

      if (surveyError) throw surveyError

      // Create questions
      const questionsToInsert = questions.map((q, index) => ({
        survey_id: survey.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options?.length ? q.options : null,
        is_required: q.is_required,
        order_index: index
      }))

      const { error: questionsError } = await supabase
        .from('survey_questions')
        .insert(questionsToInsert)

      if (questionsError) throw questionsError

      // Deduct points from user (survey creation cost)
      const { error: transactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: user?.id,
            amount: -formData.total_budget,
            transaction_type: 'survey_creation',
            related_id: survey.id,
            description: `アンケート作成: ${formData.title}`
          }
        ])

      if (transactionError) throw transactionError

      // Update user points
      const { error: updateUserPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: user?.id,
          amount: -formData.total_budget
        })

      if (updateUserPointsError) throw updateUserPointsError

      alert('アンケートを作成しました！')
      router.push('/surveys')
    } catch (error: any) {
      console.error('Error creating survey:', error)
      alert('アンケートの作成に失敗しました: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              アンケート作成
            </h1>
            <p className="text-gray-600">
              質問を作成して回答者からフィードバックを収集しよう
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('builder')}
                  className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'builder'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>編集</span>
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'preview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>プレビュー</span>
                  </span>
                </button>
              </nav>
            </div>
          </div>

          {activeTab === 'preview' ? (
            <SurveyPreview
              title={formData.title}
              description={formData.description}
              questions={questions}
              rewardPoints={rewardPerResponse}
            />
          ) : (
            <div className="bg-white shadow rounded-lg p-8">
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information Section */}
              <div className="border-b border-gray-200 pb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-6">基本情報</h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      タイトル *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="アンケートのタイトルを入力"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      説明
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="アンケートの説明を入力"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        カテゴリ *
                      </label>
                      <select
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">カテゴリを選択</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        締切日 *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Points and Target Section */}
              <div className="border-b border-gray-200 pb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-6">ポイント設定</h3>

                <div className="space-y-6">
                  {/* Quick Settings */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">クイック設定</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { budget: 1000, responses: 10, label: '低予算' },
                        { budget: 2000, responses: 20, label: '標準' },
                        { budget: 5000, responses: 50, label: '中規模' },
                        { budget: 10000, responses: 100, label: '大規模' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData({ 
                            ...formData, 
                            total_budget: preset.budget, 
                            max_responses: preset.responses 
                          })}
                          className="p-3 text-center border border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors duration-200"
                        >
                          <div className="text-sm font-medium text-gray-900">{preset.label}</div>
                          <div className="text-xs text-gray-500">{preset.budget}pt / {preset.responses}人</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        消費ポイント数 *
                      </label>
                      <div className="relative">
                        <input
                          type="range"
                          min="1000"
                          max="50000"
                          step="100"
                          value={formData.total_budget}
                          onChange={(e) => setFormData({ ...formData, total_budget: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-2"
                        />
                        <input
                          type="number"
                          required
                          min="1000"
                          step="100"
                          value={formData.total_budget}
                          onChange={(e) => setFormData({ ...formData, total_budget: parseInt(e.target.value) || 1000 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="1000"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        1000ポイント以上、100ポイント単位で設定
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        集めたい人数 *
                      </label>
                      <div className="relative">
                        <input
                          type="range"
                          min="10"
                          max="1000"
                          step="10"
                          value={formData.max_responses}
                          onChange={(e) => setFormData({ ...formData, max_responses: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-2"
                        />
                        <input
                          type="number"
                          required
                          min="10"
                          step="10"
                          value={formData.max_responses}
                          onChange={(e) => setFormData({ ...formData, max_responses: parseInt(e.target.value) || 10 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="10"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        10人以上、10人単位で設定
                      </p>
                    </div>
                  </div>

                  {/* Points Calculation Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      ポイント計算
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-2xl font-bold text-blue-600">{formData.total_budget.toLocaleString()}</div>
                        <div className="text-xs text-gray-600">消費ポイント</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-2xl font-bold text-green-600">{formData.max_responses}</div>
                        <div className="text-xs text-gray-600">目標人数</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-2xl font-bold text-orange-600">{rewardPerResponse.toLocaleString()}</div>
                        <div className="text-xs text-gray-600">1人あたり報酬</div>
                      </div>
                    </div>
                    <div className="bg-blue-100 rounded-lg p-3">
                      <p className="text-sm text-blue-800 flex items-center">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        締切までに目標人数が集まらない場合、余ったポイントは返金されます
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Questions Section */}
              <SurveyBuilderSimple
                questions={questions}
                onQuestionsChange={setQuestions}
              />

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? '作成中...' : 'アンケートを作成'}
                </button>
              </div>
            </form>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}