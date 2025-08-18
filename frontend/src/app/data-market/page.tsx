'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row']
  users: Database['public']['Tables']['users']['Row']
}

type DataListing = {
  id: string
  survey_id: string
  seller_id: string
  title: string
  description: string | null
  price_type: 'free' | 'paid'
  price: number
  revenue_per_sale: number
  total_sales: number
  total_revenue: number
  is_active: boolean
  created_at: string
  survey: Survey
}

export default function DataMarketPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState<DataListing[]>([])
  const [mySurveys, setMySurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'market' | 'sell'>('market')
  const [showListingModal, setShowListingModal] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [listingForm, setListingForm] = useState({
    title: '',
    description: '',
    price_type: 'paid' as 'free' | 'paid'
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketData()
    } else {
      fetchMySurveys()
    }
  }, [activeTab, user])

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('data_market_listings')
        .select(`
          *,
          survey:surveys(
            *,
            categories (*),
            users (username)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error && error.message.includes('Could not find the table')) {
        console.log('データマーケットのテーブルがまだ作成されていません')
        setListings([])
        return
      }

      if (data) {
        setListings(data as DataListing[])
      }
    } catch (error) {
      console.error('Error fetching market data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMySurveys = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // 自分のアンケートを取得
      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select(`
          *,
          categories (*),
          users (username)
        `)
        .eq('creator_id', user.id)
        .gt('current_responses', 0) // 1回答以上（テスト用）
        .order('created_at', { ascending: false })

      if (surveysError) {
        console.error('Error fetching surveys:', surveysError)
        return
      }

      // 既に出品されているアンケートIDを取得
      const { data: listingsData, error: listingsError } = await supabase
        .from('data_market_listings')
        .select('survey_id')
        .eq('seller_id', user.id)
        .eq('is_active', true)

      const listedSurveyIds = new Set(listingsData?.map(l => l.survey_id) || [])

      // 未出品のアンケートのみをフィルタリング
      const availableSurveys = surveysData?.filter(survey => 
        !listedSurveyIds.has(survey.id)
      ) || []

      setMySurveys(availableSurveys as Survey[])
    } catch (error) {
      console.error('Error fetching my surveys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (listing: DataListing) => {
    if (!user) return

    // 無料の場合は購入処理不要
    if (listing.price_type === 'free') {
      alert('このデータセットは無料です！プレビューで全データを確認できます。')
      return
    }

    setPurchaseLoading(listing.id)

    try {
      // Check if user has enough points
      const { data: userData } = await supabase
        .from('users')
        .select('points')
        .eq('id', user.id)
        .single()

      if (!userData || userData.points < listing.price) {
        alert('ポイントが不足しています')
        return
      }

      // Check if already purchased
      const { data: existingPurchase } = await supabase
        .from('data_purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('listing_id', listing.id)
        .single()

      if (existingPurchase) {
        alert('既に購入済みです')
        return
      }

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('data_purchases')
        .insert([
          {
            listing_id: listing.id,
            buyer_id: user.id,
            seller_id: listing.seller_id,
            price_paid: listing.price,
            revenue_to_seller: listing.revenue_per_sale
          }
        ])

      if (purchaseError) throw purchaseError

      // Deduct points from buyer
      const { error: buyerTransactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: user.id,
            amount: -listing.price,
            transaction_type: 'data_purchase',
            related_id: listing.survey_id,
            description: `データ購入: ${listing.title}`
          }
        ])

      if (buyerTransactionError) throw buyerTransactionError

      // Update buyer points
      const { error: updateBuyerPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: user.id,
          amount: -listing.price
        })

      if (updateBuyerPointsError) throw updateBuyerPointsError

      // Add points to seller
      const { error: sellerTransactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: listing.seller_id,
            amount: listing.revenue_per_sale,
            transaction_type: 'data_sale',
            related_id: listing.survey_id,
            description: `データ販売: ${listing.title}`
          }
        ])

      if (sellerTransactionError) throw sellerTransactionError

      // Update seller points
      const { error: updateSellerPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: listing.seller_id,
          amount: listing.revenue_per_sale
        })

      if (updateSellerPointsError) throw updateSellerPointsError

      // Update listing sales count
      const { error: updateListingError } = await supabase
        .rpc('update_listing_sales', {
          listing_id: listing.id,
          revenue_amount: listing.revenue_per_sale
        })

      if (updateListingError) throw updateListingError

      alert('データを購入しました！')
      
      // Refresh listings
      fetchMarketData()
      
    } catch (error: any) {
      console.error('Error purchasing data:', error)
      alert('購入に失敗しました: ' + error.message)
    } finally {
      setPurchaseLoading(null)
    }
  }

  const handleCreateListing = async () => {
    if (!selectedSurvey || !user) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('data_market_listings')
        .insert([
          {
            survey_id: selectedSurvey.id,
            seller_id: user.id,
            title: listingForm.title || selectedSurvey.title,
            description: listingForm.description || selectedSurvey.description,
            price_type: listingForm.price_type,
            price: listingForm.price_type === 'paid' ? 1000 : 0,
            revenue_per_sale: listingForm.price_type === 'paid' ? 100 : 0
          }
        ])

      if (error) throw error

      alert('データを出品しました！')
      setShowListingModal(false)
      setListingForm({ title: '', description: '', price_type: 'paid' })
      setSelectedSurvey(null)
      fetchMySurveys()
    } catch (error: any) {
      console.error('Error creating listing:', error)
      alert('出品に失敗しました: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getPreviewData = async (listing: DataListing) => {
    try {
      // サンプルデータを取得（最初の3行のみ）
      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('id, submitted_at, responses')
        .eq('survey_id', listing.survey_id)
        .limit(3)

      if (error) throw error

      return {
        survey_title: listing.title,
        total_responses: listing.survey.current_responses,
        preview_note: '※これは最初の3件のプレビューです。実際のデータセットにはすべての回答が含まれます。',
        sample_responses: responses?.map((resp, index) => ({
          response_id: index + 1,
          submitted_at: new Date(resp.submitted_at).toLocaleDateString('ja-JP'),
          responses: resp.responses
        })) || []
      }
    } catch (error) {
      console.error('Error getting preview data:', error)
      return null
    }
  }

  const downloadPreview = async (listing: DataListing) => {
    const previewData = await getPreviewData(listing)
    if (!previewData) {
      alert('プレビューデータの取得に失敗しました')
      return
    }

    const blob = new Blob([JSON.stringify(previewData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preview_${listing.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">データマーケット</h1>
          <div className="text-sm text-gray-600">
            データの売買ができます
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('market')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'market'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                データを購入
              </button>
              <button
                onClick={() => setActiveTab('sell')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sell'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                データを販売
              </button>
            </nav>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'market' ? (
              <>
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      販売中のデータセットがありません
                    </h3>
                    <p className="text-gray-500">
                      データマーケット機能を使用するには、データベースのセットアップが必要です。
                    </p>
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>セットアップ手順:</strong><br/>
                        1. Supabaseダッシュボードの「SQL Editor」にアクセス<br/>
                        2. data_market_schema.sql の内容を実行<br/>
                        3. ページを再読み込み
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {listings.map((listing) => (
                      <div key={listing.id} className="bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-shadow duration-200">
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {listing.survey.categories?.name}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  {listing.survey.current_responses}回答
                                </span>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  {listing.total_sales}販売済
                                </span>
                              </div>
                              
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {listing.title}
                              </h3>
                              
                              <p className="text-gray-600 mb-4 line-clamp-2">
                                {listing.description}
                              </p>
                              
                              <div className="flex items-center text-sm text-gray-500 mb-4">
                                <div className="flex items-center mr-6">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  {listing.survey.users?.username}
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(listing.created_at).toLocaleDateString('ja-JP')}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right ml-6">
                              {listing.price_type === 'free' ? (
                                <div className="text-2xl font-bold text-green-600 mb-1">
                                  FREE
                                </div>
                              ) : (
                                <div className="text-2xl font-bold text-green-600 mb-1">
                                  {listing.price.toLocaleString()}pt
                                </div>
                              )}
                              <div className="text-sm text-gray-500">
                                {listing.price_type === 'free' ? '無料データセット' : `作成者収益: ${listing.revenue_per_sale}pt`}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => window.location.href = `/data-market/${listing.id}`}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              詳細とプレビューを見る
                            </button>
                            
                            <button
                              onClick={() => handlePurchase(listing)}
                              disabled={purchaseLoading === listing.id || listing.seller_id === user?.id}
                              className={`py-3 px-6 rounded-lg font-medium transition-colors flex items-center ${
                                listing.price_type === 'free' 
                                  ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                              }`}
                            >
                              {purchaseLoading === listing.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                  </svg>
                                  購入中...
                                </>
                              ) : listing.seller_id === user?.id ? (
                                '自分の出品'
                              ) : listing.price_type === 'free' ? (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  無料で取得
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
                                  </svg>
                                  購入する
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {mySurveys.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      出品できるアンケートがありません
                    </h3>
                    <p className="text-gray-500">
                      1件以上の回答があり、まだ出品していないアンケートを出品できます。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mySurveys.map((survey) => (
                      <div key={survey.id} className="bg-white overflow-hidden shadow-lg rounded-xl border">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {survey.categories?.name}
                            </span>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {survey.current_responses}件の回答
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {survey.title}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {survey.description}
                          </p>
                          
                          <div className="space-y-2 mb-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">作成日:</span>
                              <span className="font-medium">
                                {new Date(survey.created_at).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">予想収益:</span>
                              <span className="font-medium text-green-600">100pt/販売</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              setSelectedSurvey(survey)
                              setListingForm({
                                title: survey.title,
                                description: survey.description || '',
                                price_type: 'paid'
                              })
                              setShowListingModal(true)
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                          >
                            データを出品する
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 出品モーダル */}
        {showListingModal && selectedSurvey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">データを出品</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={listingForm.title}
                    onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    説明
                  </label>
                  <textarea
                    value={listingForm.description}
                    onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    販売タイプ <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="price_type"
                        value="free"
                        checked={listingForm.price_type === 'free'}
                        onChange={(e) => setListingForm({ ...listingForm, price_type: e.target.value as 'free' | 'paid' })}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">無料 (FREE)</div>
                        <div className="text-sm text-gray-600">誰でも自由にダウンロード可能</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="price_type"
                        value="paid"
                        checked={listingForm.price_type === 'paid'}
                        onChange={(e) => setListingForm({ ...listingForm, price_type: e.target.value as 'free' | 'paid' })}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">有料 (1000pt)</div>
                        <div className="text-sm text-gray-600">購入者から1000pt、あなたに100pt収益</div>
                      </div>
                    </label>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>販売価格:</span>
                      <span className="font-semibold">
                        {listingForm.price_type === 'free' ? '無料 (FREE)' : '1000pt'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>あなたの収益:</span>
                      <span className={`font-semibold ${listingForm.price_type === 'free' ? 'text-gray-500' : 'text-green-600'}`}>
                        {listingForm.price_type === 'free' ? 'なし' : '100pt/販売'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>対象データ件数:</span>
                      <span className="font-semibold">{selectedSurvey.current_responses}件</span>
                    </div>
                    <div className="flex justify-between">
                      <span>データアクセス:</span>
                      <span className="font-semibold text-blue-600">
                        {listingForm.price_type === 'free' ? '全データプレビュー可' : '3件プレビューのみ'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowListingModal(false)
                    setSelectedSurvey(null)
                    setListingForm({ title: '', description: '', price_type: 'paid' })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateListing}
                  disabled={submitting || !listingForm.title}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '出品中...' : '出品する'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">データマーケットについて</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 1件以上の回答があるアンケートデータを販売できます（テスト中）</li>
            <li>• 販売価格は1000pt固定、作成者収益は100pt/販売です</li>
            <li>• プレビューで最初の3件の回答を確認できます</li>
            <li>• 購入したデータは分析・研究目的でご利用ください</li>
            <li>• 個人情報は含まれていません</li>
          </ul>
        </div>
      </div>
    </ProtectedRoute>
  )
}