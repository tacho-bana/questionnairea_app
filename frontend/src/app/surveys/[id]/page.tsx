'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row']
  users: Database['public']['Tables']['users']['Row']
}
type SurveyQuestion = Database['public']['Tables']['survey_questions']['Row']

export default function SurveyDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hasResponded, setHasResponded] = useState(false)

  useEffect(() => {
    if (user && surveyId) {
      fetchSurveyData()
      checkUserResponse()
    }
  }, [user, surveyId])

  const fetchSurveyData = async () => {
    try {
      // Fetch survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select(`
          *,
          categories (*),
          users (username)
        `)
        .eq('id', surveyId)
        .eq('status', 'active')
        .single()

      if (surveyError || !surveyData) {
        throw new Error('アンケートが見つかりません')
      }

      // Check if user is trying to answer their own survey
      if (surveyData.creator_id === user?.id) {
        alert('自分で作成したアンケートには回答できません')
        router.push('/surveys')
        return
      }

      setSurvey(surveyData as Survey)

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index')

      if (questionsData) {
        setQuestions(questionsData)
        
        // Initialize responses
        const initialResponses: Record<string, any> = {}
        questionsData.forEach(q => {
          initialResponses[q.id] = q.question_type === 'multiple_choice' ? '' : ''
        })
        setResponses(initialResponses)
      }

    } catch (error: any) {
      console.error('Error fetching survey:', error)
      alert('アンケートの取得に失敗しました: ' + error.message)
      router.push('/surveys')
    } finally {
      setLoading(false)
    }
  }

  const checkUserResponse = async () => {
    if (!user || !surveyId) return

    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('respondent_id', user.id)
        .single()

      if (data) {
        setHasResponded(true)
      }
    } catch (error) {
      // No existing response found, which is fine
    }
  }

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const validateResponses = () => {
    const requiredQuestions = questions.filter(q => q.is_required)
    
    for (const question of requiredQuestions) {
      const response = responses[question.id]
      if (!response || (typeof response === 'string' && response.trim() === '')) {
        return `「${question.question_text}」は必須項目です`
      }
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !survey) return

    // Validate responses
    const validationError = validateResponses()
    if (validationError) {
      alert(validationError)
      return
    }

    setSubmitting(true)

    try {
      // Check if survey is still available
      if (survey.max_responses && survey.current_responses >= survey.max_responses) {
        alert('このアンケートは回答数の上限に達しています')
        return
      }

      // Check if survey is expired
      if (survey.deadline && new Date(survey.deadline) < new Date()) {
        alert('このアンケートは締切を過ぎています')
        return
      }

      // Create response record
      const { data: responseData, error: responseError } = await supabase
        .from('survey_responses')
        .insert([
          {
            survey_id: surveyId,
            respondent_id: user.id,
            responses: responses,
            is_approved: true // Will be updated after quality check
          }
        ])
        .select()
        .single()

      if (responseError) throw responseError

      // Award points to respondent
      const { error: pointsError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: user.id,
            amount: survey.reward_points,
            transaction_type: 'survey_reward',
            related_id: surveyId,
            description: `アンケート回答報酬: ${survey.title}`
          }
        ])

      if (pointsError) throw pointsError

      // Update user points
      const { error: updateUserPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: user.id,
          amount: survey.reward_points
        })

      if (updateUserPointsError) throw updateUserPointsError

      // Update survey response count manually (until database trigger is set up)
      const { error: updateCountError } = await supabase
        .from('surveys')
        .update({ 
          current_responses: (survey.current_responses || 0) + 1 
        })
        .eq('id', surveyId)

      if (updateCountError) {
        console.error('Error updating response count:', updateCountError)
        // Don't throw error, just log it
      }

      alert(`回答ありがとうございました！${survey.reward_points}ポイントを獲得しました！`)
      router.push('/surveys')

    } catch (error: any) {
      console.error('Error submitting response:', error)
      alert('回答の送信に失敗しました: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (question: SurveyQuestion) => {
    const questionId = question.id

    switch (question.question_type) {
      case 'multiple_choice':
        const options = question.options as string[] || []
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input
                    type="radio"
                    name={questionId}
                    value={option}
                    checked={responses[questionId] === option}
                    onChange={(e) => handleResponseChange(questionId, e.target.value)}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        )

      case 'text':
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
            />
          </div>
        )

      case 'textarea':
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
            />
          </div>
        )

      case 'checkbox':
        const checkboxOptions = question.options as string[] || []
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {checkboxOptions.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    value={option}
                    checked={(responses[questionId] || []).includes(option)}
                    onChange={(e) => {
                      const currentValues = responses[questionId] || []
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter((v: string) => v !== option)
                      handleResponseChange(questionId, newValues)
                    }}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        )

      case 'dropdown':
        const dropdownOptions = question.options as string[] || []
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">選択してください</option>
              {dropdownOptions.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )

      case 'number':
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="数値を入力してください"
            />
          </div>
        )

      default:
        return (
          <div key={questionId} className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
            />
          </div>
        )
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!survey) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4">
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">❓</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                アンケートが見つかりません
              </h3>
              <p className="text-gray-500 mb-4">
                指定されたアンケートは存在しないか、既に終了しています。
              </p>
            <button
              onClick={() => router.push('/surveys')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              アンケート一覧に戻る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (hasResponded) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4">
            <div className="text-center py-12">
              <div className="text-green-400 text-6xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                回答済みです
              </h3>
              <p className="text-gray-500 mb-4">
                このアンケートには既に回答いただいています。
              </p>
            <button
              onClick={() => router.push('/surveys')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              他のアンケートを見る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-6 px-4">
          <div className="bg-white shadow rounded-lg p-6">
            {/* Survey Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {survey.categories?.name}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  報酬: {survey.reward_points}pt
                </span>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {survey.title}
              </h1>

              {survey.description && (
                <p className="text-gray-600 mb-4">
                  {survey.description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500 mb-6">
                <div className="space-y-1">
                  <div>作成者: {survey.users?.username}</div>
                  <div>回答数: {survey.current_responses}/{survey.max_responses}人</div>
                </div>
                <div className="space-y-1">
                  <div>作成日: {new Date(survey.created_at).toLocaleDateString('ja-JP')}</div>
                  {survey.deadline && (
                    <div>
                      締切: {new Date(survey.deadline).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">ℹ️</div>
                  <div>
                    <h4 className="text-blue-900 font-medium mb-1">回答について</h4>
                    <p className="text-blue-800 text-sm">
                      すべての質問に回答してください。回答後、{survey.reward_points}ポイントが獲得できます。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-8">
                {questions.map(renderQuestion)}
              </div>

              <div className="mt-8 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => router.push('/surveys')}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md"
                >
                  {submitting ? '送信中...' : '回答を送信'}
                </button>
              </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}