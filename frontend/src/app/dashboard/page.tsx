'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProfileSetup from '@/components/ProfileSetup'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row']
type PointTransaction = Database['public']['Tables']['point_transactions']['Row']

export default function Dashboard() {
  const { user } = useAuth()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [mySurveys, setMySurveys] = useState<Survey[]>([])
  const [recentTransactions, setRecentTransactions] = useState<PointTransaction[]>([])
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [stats, setStats] = useState({
    completedSurveys: 0,
    mySurveys: 0,
  })

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      setUserProfile(profile)
      
      // 新規ユーザーまたはプロフィール未完成の場合、プロフィール設定を表示
      if (profile && !profile.profile_completed) {
        setShowProfileSetup(true)
      }

      // 自分が作成したアンケート
      const { data: mySurveysData, error: mySurveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('creator_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (mySurveysError) {
        console.error('Error fetching my surveys:', mySurveysError)
      }

      setMySurveys(mySurveysData || [])

      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentTransactions(transactions || [])

      const { data: completedSurveys } = await supabase
        .from('survey_responses')
        .select('survey_id')
        .eq('respondent_id', user?.id)

      setStats({
        completedSurveys: completedSurveys?.length || 0,
        mySurveys: mySurveysData?.length || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const handleProfileSetupComplete = () => {
    setShowProfileSetup(false)
    // プロフィールデータを再取得（少し遅延させてリアルタイム更新を反映）
    setTimeout(() => {
      fetchDashboardData()
    }, 1500)
  }

  return (
    <ProtectedRoute>
      {showProfileSetup && (
        <ProfileSetup onComplete={handleProfileSetupComplete} />
      )}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                ダッシュボード
              </h1>
              <p className="text-gray-600">
                こんにちは、{userProfile?.username || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}さん
              </p>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Completed Surveys Card */}
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">回答済み</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.completedSurveys}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg">件</div>
                </div>
              </div>

              {/* Reputation Score Card */}
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">信頼度</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userProfile?.reputation_score || 100}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-lg">pt</div>
                </div>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* My Surveys */}
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <span>私のアンケート</span>
                    </h3>
                    <Link
                      href="/create-survey"
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium bg-orange-50 px-3 py-1 rounded-lg transition-colors duration-200"
                    >
                      新規作成
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {mySurveys.length > 0 ? (
                    mySurveys.map((survey) => (
                      <div key={survey.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {survey.title}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {survey.description?.slice(0, 80)}...
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{survey.current_responses}/{survey.max_responses}人回答済み</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                          </div>
                          <div className="ml-4 flex flex-col items-end space-y-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {survey.reward_points}pt
                            </span>
                            <Link
                              href={`/my-surveys/${survey.id}`}
                              className="text-orange-600 hover:text-orange-500 text-sm font-medium"
                            >
                              詳細を見る
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-gray-500 mb-4">まだアンケートを作成していません</p>
                      <Link
                        href="/create-survey"
                        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
                      >
                        初回アンケートを作成
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <span>最近の取引履歴</span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.amount > 0 
                                ? 'bg-green-100' 
                                : 'bg-red-100'
                            }`}>
                              {transaction.amount > 0 ? (
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {transaction.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(transaction.created_at).toLocaleDateString('ja-JP')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${
                              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}pt
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-gray-500">取引履歴がありません</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
    </ProtectedRoute>
  )
}