'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row']
  users: Database['public']['Tables']['users']['Row']
}

export default function DataMarketPage() {
  const { user } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchMarketData()
  }, [])

  const fetchMarketData = async () => {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select(`
          *,
          categories (*),
          users (username)
        `)
        .eq('is_data_for_sale', true)
        .gt('current_responses', 0)
        .order('created_at', { ascending: false })

      if (data) {
        setSurveys(data as Survey[])
      }
    } catch (error) {
      console.error('Error fetching market data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (survey: Survey) => {
    if (!user) return

    setPurchaseLoading(survey.id)

    try {
      // Check if user has enough points
      const { data: userData } = await supabase
        .from('users')
        .select('points')
        .eq('id', user.id)
        .single()

      if (!userData || userData.points < survey.data_price) {
        alert('ポイントが不足しています')
        return
      }

      // Create data sale record
      const { error: saleError } = await supabase
        .from('data_sales')
        .insert([
          {
            survey_id: survey.id,
            buyer_id: user.id,
            seller_id: survey.creator_id,
            price: survey.data_price
          }
        ])

      if (saleError) throw saleError

      // Deduct points from buyer
      const { error: buyerTransactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: user.id,
            amount: -survey.data_price,
            transaction_type: 'data_purchase',
            related_id: survey.id,
            description: `データ購入: ${survey.title}`
          }
        ])

      if (buyerTransactionError) throw buyerTransactionError

      // Update buyer points
      const { error: updateBuyerPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: user.id,
          amount: -survey.data_price
        })

      if (updateBuyerPointsError) throw updateBuyerPointsError

      // Add points to seller
      const { error: sellerTransactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: survey.creator_id,
            amount: survey.data_price,
            transaction_type: 'data_sale',
            related_id: survey.id,
            description: `データ販売: ${survey.title}`
          }
        ])

      if (sellerTransactionError) throw sellerTransactionError

      // Update seller points
      const { error: updateSellerPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: survey.creator_id,
          amount: survey.data_price
        })

      if (updateSellerPointsError) throw updateSellerPointsError

      alert('データを購入しました！')
      
      // In a real implementation, you would download the data here
      // For now, we'll just show a success message
      
    } catch (error: any) {
      console.error('Error purchasing data:', error)
      alert('購入に失敗しました: ' + error.message)
    } finally {
      setPurchaseLoading(null)
    }
  }

  const downloadSampleData = (survey: Survey) => {
    // Generate sample data for preview
    const sampleData = {
      survey_title: survey.title,
      total_responses: Math.min(5, survey.current_responses),
      sample_responses: [
        { response_id: 1, submitted_at: '2024-01-01', responses: { question_1: 'サンプル回答1' } },
        { response_id: 2, submitted_at: '2024-01-02', responses: { question_1: 'サンプル回答2' } },
      ]
    }

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sample_${survey.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">データマーケット</h1>
              <div className="text-sm text-gray-600">
                アンケートの回答データを購入できます
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {surveys.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      販売中のデータがありません
                    </h3>
                    <p className="text-gray-500">
                      まだ販売されているアンケートデータがありません。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {surveys.map((survey) => (
                      <div key={survey.id} className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {survey.categories?.name}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {survey.data_price}pt
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {survey.title}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {survey.description}
                          </p>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">作成者:</span>
                              <span className="font-medium">{survey.users?.username}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">回答数:</span>
                              <span className="font-medium">{survey.current_responses}件</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">作成日:</span>
                              <span className="font-medium">
                                {new Date(survey.created_at).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <button
                              onClick={() => downloadSampleData(survey)}
                              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md text-sm font-medium transition-colors"
                            >
                              サンプルデータをダウンロード
                            </button>
                            
                            <button
                              onClick={() => handlePurchase(survey)}
                              disabled={purchaseLoading === survey.id || survey.creator_id === user?.id}
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                            >
                              {purchaseLoading === survey.id ? (
                                '購入中...'
                              ) : survey.creator_id === user?.id ? (
                                '自分のアンケート'
                              ) : (
                                `${survey.data_price}ptで購入`
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-2">データマーケットについて</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• アンケート作成者が回答データを販売できます</li>
                <li>• サンプルデータで内容を事前確認できます</li>
                <li>• 購入したデータは分析・研究目的でご利用ください</li>
                <li>• 個人情報は含まれていません</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}