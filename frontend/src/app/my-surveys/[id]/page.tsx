'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row']
}
type SurveyResponse = Database['public']['Tables']['survey_responses']['Row'] & {
  users: { username: string; email: string }
}
type SurveyQuestion = Database['public']['Tables']['survey_questions']['Row']

export default function MySurveyDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [newDeadline, setNewDeadline] = useState('')
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [showDangerZone, setShowDangerZone] = useState(false)

  useEffect(() => {
    console.log('User state:', user)
    console.log('Survey ID:', surveyId)
    if (surveyId && user?.id) {
      fetchSurveyData()
    }
  }, [surveyId, user?.id])

  const fetchSurveyData = async () => {
    try {
      setLoading(true)

      if (!user?.id) {
        throw new Error('ユーザー認証が必要です')
      }

      // Survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select(`
          *,
          categories (*)
        `)
        .eq('id', surveyId)
        .eq('creator_id', user.id)
        .single()

      if (surveyError) throw surveyError
      setSurvey(surveyData as Survey)
      setNewDeadline(surveyData.deadline || '')

      // Survey questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index')

      if (questionsError) throw questionsError
      setQuestions(questionsData)

      // Survey responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('survey_responses')
        .select(`
          *,
          users (username, email)
        `)
        .eq('survey_id', surveyId)

      if (responsesError) throw responsesError
      setResponses(responsesData as SurveyResponse[])

      // Debug: Log the responses data
      console.log('Survey responses data:', responsesData)
      console.log('Questions data:', questionsData)

      // Generate analysis data
      generateAnalysisData(responsesData as SurveyResponse[], questionsData)

    } catch (error: any) {
      console.error('Error fetching survey data:', error)
      if (error.code === 'PGRST116') {
        alert('アンケートが見つからないか、アクセス権限がありません')
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const generateAnalysisData = (responsesData: SurveyResponse[], questionsData: SurveyQuestion[]) => {
    if (!responsesData.length || !questionsData.length) return

    const analysis: any = {}

    // Response timeline
    const responsesByDate = responsesData.reduce((acc: any, response) => {
      const date = new Date(response.submitted_at || response.created_at).toLocaleDateString('ja-JP')
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    analysis.responseTimeline = responsesByDate

    // Question analysis - responses are stored in JSONB format
    questionsData.forEach((question) => {
      const answers = responsesData.map(response => {
        const responseData = response.responses as any
        return responseData ? responseData[question.id] : null
      }).filter(answer => answer !== null && answer !== undefined)

      if (question.question_type === 'multiple_choice') {
        // For multiple choice, count answer frequency
        const answerCounts = answers.reduce((acc: any, answer) => {
          const text = answer || '未回答'
          acc[text] = (acc[text] || 0) + 1
          return acc
        }, {})

        analysis[`question_${question.id}`] = {
          type: 'pie',
          data: answerCounts,
          total: answers.length
        }
      } else if (question.question_type === 'rating') {
        // For rating questions, show distribution
        const ratingCounts = answers.reduce((acc: any, answer) => {
          const rating = parseInt(String(answer) || '0')
          if (rating >= 1 && rating <= 5) {
            acc[rating] = (acc[rating] || 0) + 1
          }
          return acc
        }, {})

        const ratingData = [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: ratingCounts[rating] || 0,
          percentage: answers.length > 0 ? ((ratingCounts[rating] || 0) / answers.length) * 100 : 0
        }))

        analysis[`question_${question.id}`] = {
          type: 'bar',
          data: ratingData,
          total: answers.length,
          average: answers.length > 0 ? 
            answers.reduce((sum, answer) => sum + (parseInt(String(answer) || '0') || 0), 0) / answers.length : 0
        }
      } else if (question.question_type === 'text') {
        // For text questions, show sample responses
        const textResponses = answers.filter(answer => answer && String(answer).trim().length > 0)
        analysis[`question_${question.id}`] = {
          type: 'text',
          responses: textResponses.slice(0, 10).map(answer => String(answer)),
          total: textResponses.length
        }
      }
    })

    setAnalysisData(analysis)
  }

  const handleUpdateDeadline = async () => {
    if (!survey || !newDeadline) return

    try {
      const { error } = await supabase
        .from('surveys')
        .update({ deadline: newDeadline })
        .eq('id', survey.id)

      if (error) throw error

      setSurvey({ ...survey, deadline: newDeadline })
      setIsEditing(false)
      alert('締切日を更新しました')
    } catch (error: any) {
      console.error('Error updating deadline:', error)
      alert('締切日の更新に失敗しました: ' + error.message)
    }
  }

  const handleCloseSurvey = async () => {
    if (!survey) return

    const confirmed = confirm(
      '募集を終了しますか？\n\n' +
      '・アンケートのステータスが「終了」に変更されます\n' +
      '・新しい回答を受け付けなくなります\n' +
      `・未配布の${((survey.max_responses - survey.current_responses) * survey.reward_points).toLocaleString()}ポイントが返還されます`
    )
    if (!confirmed) return

    try {
      // Calculate refund amount
      const unusedResponses = survey.max_responses - survey.current_responses
      const refundAmount = unusedResponses * survey.reward_points

      // Update survey status to closed
      const { error: updateError } = await supabase
        .from('surveys')
        .update({ status: 'closed' })
        .eq('id', survey.id)

      if (updateError) throw updateError

      // Refund points if there are unused responses
      if (refundAmount > 0) {
        // Add refund transaction
        const { error: transactionError } = await supabase
          .from('point_transactions')
          .insert([
            {
              user_id: user?.id,
              amount: refundAmount,
              transaction_type: 'survey_closure',
              related_id: survey.id,
              description: `アンケート終了による返金: ${survey.title}`
            }
          ])

        if (transactionError) throw transactionError

        // Update user points
        const { error: updatePointsError } = await supabase
          .rpc('increment_user_points', {
            user_id: user?.id,
            amount: refundAmount
          })

        if (updatePointsError) throw updatePointsError
      }

      // Update local state
      setSurvey({ ...survey, status: 'closed' })

      alert(
        `アンケートの募集を終了しました。\n${refundAmount > 0 ? `${refundAmount.toLocaleString()}ポイントを返金しました。` : ''}`
      )
    } catch (error: any) {
      console.error('Error closing survey:', error)
      alert('アンケートの終了に失敗しました: ' + error.message)
    }
  }

  const handleDeleteSurvey = async () => {
    if (!survey) return

    const confirmed = confirm('本当にこのアンケートを削除しますか？未配布のポイントは返還されます。')
    if (!confirmed) return

    try {
      // Calculate refund amount
      const unusedResponses = survey.max_responses - survey.current_responses
      const refundAmount = unusedResponses * survey.reward_points

      // Delete survey (this will cascade delete related data)
      const { error: deleteError } = await supabase
        .from('surveys')
        .delete()
        .eq('id', survey.id)

      if (deleteError) throw deleteError

      // Refund points if there are unused responses
      if (refundAmount > 0) {
        // Add refund transaction
        const { error: transactionError } = await supabase
          .from('point_transactions')
          .insert([
            {
              user_id: user?.id,
              amount: refundAmount,
              transaction_type: 'survey_refund',
              related_id: survey.id,
              description: `アンケート削除による返金: ${survey.title}`
            }
          ])

        if (transactionError) throw transactionError

        // Update user points
        const { error: updatePointsError } = await supabase
          .rpc('increment_user_points', {
            user_id: user?.id,
            amount: refundAmount
          })

        if (updatePointsError) throw updatePointsError
      }

      alert(`アンケートを削除しました。${refundAmount > 0 ? `${refundAmount.toLocaleString()}ポイントを返金しました。` : ''}`)
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Error deleting survey:', error)
      alert('アンケートの削除に失敗しました: ' + error.message)
    }
  }

  const downloadCSV = () => {
    if (!survey || !questions || !responses) return

    // Create CSV headers
    const headers = ['回答者ID', '回答者名', '回答日時', ...questions.map(q => q.question_text)]
    
    // Create CSV data
    const csvData = responses.map(response => {
      const row = [
        response.respondent_id,
        response.users?.username || response.users?.email || '匿名',
        new Date(response.submitted_at || response.created_at).toLocaleString('ja-JP')
      ]
      
      // Add answers for each question from JSONB responses
      questions.forEach(question => {
        const responseData = response.responses as any
        const answer = responseData ? responseData[question.id] : ''
        row.push(String(answer || ''))
      })
      
      return row
    })

    // Convert to CSV format
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    // Download file with BOM for proper Japanese encoding
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${survey.title}_responses.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
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
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="max-w-4xl mx-auto py-6 px-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">アンケートが見つかりません</h1>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-500">
                ダッシュボードに戻る
              </Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link 
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{survey.title}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                survey.status === 'active' ? 'bg-green-100 text-green-800' : 
                survey.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                survey.status === 'closed' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {survey.status === 'active' ? '実施中' : 
                 survey.status === 'completed' ? '完了' : 
                 survey.status === 'closed' ? '募集終了' : '終了'}
              </span>
            </div>
            <p className="text-gray-600">{survey.description}</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">回答数</p>
                  <p className="text-2xl font-bold text-gray-900">{survey.current_responses}/{survey.max_responses}</p>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">配布済みポイント</p>
                  <p className="text-2xl font-bold text-gray-900">{(survey.current_responses * survey.reward_points).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">残りポイント</p>
                  <p className="text-2xl font-bold text-gray-900">{((survey.max_responses - survey.current_responses) * survey.reward_points).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">進捗率</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round((survey.current_responses / survey.max_responses) * 100)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">管理メニュー</h3>
            
            {/* Main Actions */}
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={downloadCSV}
                disabled={responses.length === 0}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSVダウンロード
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                disabled={survey?.status !== 'active'}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                締切編集
              </button>

              {survey?.status === 'active' && (
                <button
                  onClick={handleCloseSurvey}
                  className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m8-8.414l-1.293-1.293a1 1 0 00-1.414 0L12 9.586l-3.293-3.293a1 1 0 00-1.414 0L6 7.586A2 2 0 015.586 6H4a2 2 0 00-2 2v1.586A2 2 0 002.586 10L9 16.414a2 2 0 002.828 0L18.414 10A2 2 0 0019 8.586V7a2 2 0 00-2-2h-1.586A2 2 0 0014 5.586L13 4.586a1 1 0 00-1.414 0z" />
                  </svg>
                  募集終了
                </button>
              )}
            </div>

            {/* Danger Zone (collapsible) */}
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => setShowDangerZone(!showDangerZone)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <svg className={`w-4 h-4 mr-1 transition-transform duration-200 ${showDangerZone ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                危険操作
              </button>
              
              {showDangerZone && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-800 mb-2">アンケートを削除</h4>
                      <p className="text-xs text-red-700 mb-3">
                        この操作は取り消せません。アンケート、回答データ、関連する全ての情報が完全に削除されます。
                      </p>
                      <button
                        onClick={handleDeleteSurvey}
                        className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors duration-200"
                      >
                        完全に削除する
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Deadline Edit Form */}
            {isEditing && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">締切日の変更</h4>
                <div className="flex items-center space-x-4">
                  <input
                    type="datetime-local"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleUpdateDeadline}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    更新
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data Analysis */}
          {analysisData && responses.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">データ分析</h3>
              
              {/* Response Timeline */}
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">回答推移</h4>
                <div className="space-y-3">
                  {Object.entries(analysisData.responseTimeline).map(([date, count]: [string, any]) => (
                    <div key={date} className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600 w-24">{date}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                        <div 
                          className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                          style={{ width: `${(count / Math.max(...Object.values(analysisData.responseTimeline))) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {questions.map((question) => {
                  const questionAnalysis = analysisData[`question_${question.id}`]
                  if (!questionAnalysis) return null

                  return (
                    <div key={question.id} className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                      <h4 className="text-md font-medium text-gray-900 mb-4">
                        Q. {question.question_text}
                      </h4>
                      
                      {questionAnalysis.type === 'pie' && (
                        <div className="space-y-3">
                          {Object.entries(questionAnalysis.data).map(([answer, count]: [string, any], index) => {
                            const percentage = (count / questionAnalysis.total) * 100
                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500']
                            return (
                              <div key={answer} className="flex items-center space-x-4">
                                <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`}></div>
                                <span className="text-sm text-gray-700 flex-1">{answer}</span>
                                <span className="text-sm font-medium text-gray-900">{count}件 ({percentage.toFixed(1)}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {questionAnalysis.type === 'bar' && (
                        <div className="space-y-4">
                          <div className="text-sm text-gray-600 mb-3">
                            平均評価: {questionAnalysis.average.toFixed(1)}/5.0
                          </div>
                          {questionAnalysis.data.map((item: any) => (
                            <div key={item.rating} className="flex items-center space-x-4">
                              <span className="text-sm text-gray-600 w-8">{item.rating}★</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                                <div 
                                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-900 w-12">{item.count}件</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {questionAnalysis.type === 'text' && (
                        <div className="space-y-3">
                          <div className="text-sm text-gray-600 mb-3">
                            回答数: {questionAnalysis.total}件
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {questionAnalysis.responses.map((response: string, index: number) => (
                              <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                                "{response}"
                              </div>
                            ))}
                          </div>
                          {questionAnalysis.responses.length < questionAnalysis.total && (
                            <div className="text-xs text-gray-500 text-center">
                              他 {questionAnalysis.total - questionAnalysis.responses.length} 件の回答があります
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Survey Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Survey Information */}
            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">アンケート情報</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">カテゴリ:</span>
                  <span className="ml-2 text-sm text-gray-900">{survey.categories?.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">報酬ポイント:</span>
                  <span className="ml-2 text-sm text-gray-900">{survey.reward_points}pt/回答</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">締切:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {survey.deadline ? new Date(survey.deadline).toLocaleString('ja-JP') : '設定なし'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">作成日:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {new Date(survey.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">質問一覧</h4>
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div key={question.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <span className="text-sm font-medium text-gray-600">Q{index + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{question.question_text}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              タイプ: {question.question_type === 'text' ? 'テキスト' : 
                                     question.question_type === 'multiple_choice' ? '選択式' : '評価'}
                            </span>
                            {question.is_required && (
                              <span className="text-xs text-red-600">必須</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Responses Summary */}
            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">回答サマリー</h3>
              
              {responses.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{responses.length}</p>
                      <p className="text-sm text-blue-600">総回答数</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round((responses.length / survey.max_responses) * 100)}%
                      </p>
                      <p className="text-sm text-green-600">完了率</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">最近の回答者</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {responses.slice(-5).reverse().map((response) => (
                        <div key={response.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {response.users?.username || '匿名ユーザー'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(response.submitted_at || response.created_at).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            +{survey.reward_points}pt
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">まだ回答がありません</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}