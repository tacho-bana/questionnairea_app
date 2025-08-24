'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type PreviewData = {
  survey_title: string
  total_responses: number
  preview_note: string
  sample_responses: Array<{
    response_id: number
    submitted_at: string
    responses: any
  }>
  csv_headers: string[]
  csv_data: string[][]
  question_mapping: Array<{
    column_name: string
    question_text: string
  }>
}

export default function DatasetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [listing, setListing] = useState<DataListing | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [isPurchased, setIsPurchased] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'preview'>('overview')
  const [editMode, setEditMode] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchListingData()
    }
  }, [id, user])

  // リスティングデータが読み込まれた後にプレビューデータを取得
  useEffect(() => {
    if (listing) {
      fetchPreviewData()
      checkPurchaseStatus()
    }
  }, [listing])

  const fetchListingData = async () => {
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
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error fetching listing:', error)
        return
      }

      setListing(data as DataListing)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkPurchaseStatus = async () => {
    if (!user || !listing) return

    // 無料データセットの場合は購入チェック不要
    if (listing.price_type === 'free') {
      setIsPurchased(false)
      return
    }

    try {
      const { data } = await supabase
        .from('data_purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('listing_id', id)
        .single()

      setIsPurchased(!!data)
    } catch (error) {
      // エラーは無視（購入していない場合）
    }
  }

  const fetchPreviewData = async () => {
    // リスティングデータが読み込まれるまで待つ
    if (!listing && !id) return

    setPreviewLoading(true)
    try {
      // listing.survey_idが利用できない場合は、リスティングデータから取得
      let surveyId = listing?.survey_id
      if (!surveyId && id) {
        const { data: listingData } = await supabase
          .from('data_market_listings')
          .select('survey_id, title')
          .eq('id', id)
          .single()
        
        if (listingData) {
          surveyId = listingData.survey_id
        }
      }

      if (!surveyId) {
        console.log('Survey ID not found')
        return
      }

      // 無料データセットの場合は全データ、有料の場合は3件のみ
      const limit = listing?.price_type === 'free' ? 1000 : 3
      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('id, submitted_at, responses')
        .eq('survey_id', surveyId)
        .limit(limit)

      if (error) {
        console.error('Error fetching survey responses:', error)
        // エラーでもpreviewDataを設定してUIを表示
        setPreviewData({
          survey_title: listing?.title || 'データセット',
          total_responses: listing?.survey?.current_responses || 0,
          preview_note: 'プレビューデータの取得中にエラーが発生しました。データベースのセットアップが必要な可能性があります。',
          sample_responses: [],
          csv_headers: [],
          csv_data: [],
          question_mapping: []
        })
        return
      }

      // アンケートの質問情報を取得
      const { data: questions, error: questionsError } = await supabase
        .from('survey_questions')
        .select('question_text, order_index')
        .eq('survey_id', surveyId)
        .order('order_index')

      // CSVデータの生成
      const csvHeaders = ['response_id', 'submitted_at']
      const allKeys = new Set<string>()
      
      // すべての回答から質問キーを収集
      responses?.forEach(resp => {
        if (resp.responses && typeof resp.responses === 'object') {
          Object.keys(resp.responses).forEach(key => allKeys.add(key))
        }
      })
      
      const questionKeys = Array.from(allKeys).sort()
      
      // 質問とカラム名のマッピングを作成
      const questionMapping: Array<{column_name: string, question_text: string}> = []
      
      questionKeys.forEach((key, index) => {
        const columnName = `Q${index + 1}`
        csvHeaders.push(columnName)
        
        // 質問テキストを探す
        let questionText = key // デフォルトはキー名
        if (questions) {
          const question = questions.find(q => 
            key.includes(q.order_index?.toString()) || 
            key.toLowerCase().includes('question') ||
            index === q.order_index - 1
          )
          if (question) {
            questionText = question.question_text
          }
        }
        
        questionMapping.push({
          column_name: columnName,
          question_text: questionText
        })
      })
      
      const csvData = responses?.map((resp, index) => {
        const row = [
          (index + 1).toString(),
          new Date(resp.submitted_at).toLocaleDateString('ja-JP')
        ]
        
        questionKeys.forEach(key => {
          const value = resp.responses?.[key]
          if (Array.isArray(value)) {
            row.push(value.join('; '))
          } else if (typeof value === 'object' && value !== null) {
            row.push(JSON.stringify(value))
          } else {
            row.push(value?.toString() || '')
          }
        })
        
        return row
      }) || []

      const previewNote = listing?.price_type === 'free' 
        ? '※このデータセットは無料です。'
        : '※これは最初の3件のプレビューです。購入後、すべての回答データをダウンロードできます。'

      const preview: PreviewData = {
        survey_title: listing?.title || 'データセット',
        total_responses: listing?.survey?.current_responses || responses?.length || 0,
        preview_note: previewNote,
        sample_responses: responses?.map((resp, index) => ({
          response_id: index + 1,
          submitted_at: new Date(resp.submitted_at).toLocaleDateString('ja-JP'),
          responses: resp.responses
        })) || [],
        csv_headers: csvHeaders,
        csv_data: csvData,
        question_mapping: questionMapping
      }

      setPreviewData(preview)
    } catch (error) {
      console.error('Error fetching preview:', error)
      // エラーの場合もpreviewDataを設定
      setPreviewData({
        survey_title: listing?.title || 'データセット',
        total_responses: 0,
        preview_note: 'プレビューデータの取得に失敗しました。',
        sample_responses: [],
        csv_headers: [],
        csv_data: [],
        question_mapping: []
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePurchase = async () => {
    if (!user || !listing) return

    // 無料の場合は購入処理不要
    if (listing.price_type === 'free') {
      alert('このデータセットは無料です！プレビューで全データを確認できます。')
      return
    }

    setPurchaseLoading(true)

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
      setIsPurchased(true)
      
    } catch (error: any) {
      console.error('Error purchasing data:', error)
      alert('購入に失敗しました: ' + error.message)
    } finally {
      setPurchaseLoading(false)
    }
  }

  const convertToCSV = (headers: string[], data: string[][]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        row.map(cell => {
          // セルにカンマや改行が含まれている場合はダブルクォートで囲む
          if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(',')
      )
    ].join('\n')
    
    return csvContent
  }

  const downloadFullData = async () => {
    if (!listing) return
    
    // 無料データセットまたは購入済みデータのみダウンロード可能
    if (listing.price_type !== 'free' && !isPurchased) return

    try {
      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('id, submitted_at, responses')
        .eq('survey_id', listing.survey_id)

      if (error) throw error

      // アンケートの質問情報を取得
      const { data: questions, error: questionsError } = await supabase
        .from('survey_questions')
        .select('question_text, order_index')
        .eq('survey_id', listing.survey_id)
        .order('order_index')

      // CSVデータの生成
      const csvHeaders = ['response_id', 'submitted_at']
      const allKeys = new Set<string>()
      
      // すべての回答から質問キーを収集
      responses?.forEach(resp => {
        if (resp.responses && typeof resp.responses === 'object') {
          Object.keys(resp.responses).forEach(key => allKeys.add(key))
        }
      })
      
      const questionKeys = Array.from(allKeys).sort()
      
      // Q1, Q2のようなカラム名に変更
      questionKeys.forEach((key, index) => {
        csvHeaders.push(`Q${index + 1}`)
      })
      
      const csvData = responses?.map((resp, index) => {
        const row = [
          (index + 1).toString(),
          new Date(resp.submitted_at).toLocaleDateString('ja-JP')
        ]
        
        questionKeys.forEach(key => {
          const value = resp.responses?.[key]
          if (Array.isArray(value)) {
            row.push(value.join('; '))
          } else if (typeof value === 'object' && value !== null) {
            row.push(JSON.stringify(value))
          } else {
            row.push(value?.toString() || '')
          }
        })
        
        return row
      }) || []

      const csvContent = convertToCSV(csvHeaders, csvData)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dataset_${listing.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading data:', error)
      alert('データのダウンロードに失敗しました')
    }
  }

  const handleUpdateDescription = async () => {
    if (!listing || !user || listing.seller_id !== user.id) return

    try {
      const { error } = await supabase
        .from('data_market_listings')
        .update({ description: editDescription })
        .eq('id', listing.id)

      if (error) throw error

      // ローカル状態を更新
      setListing({ ...listing, description: editDescription })
      setEditMode(false)
      alert('説明を更新しました')
    } catch (error: any) {
      console.error('Error updating description:', error)
      alert('更新に失敗しました: ' + error.message)
    }
  }

  const startEdit = () => {
    setEditDescription(listing?.description || '')
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditDescription('')
    setEditMode(false)
  }

  const handleCancelListing = async () => {
    if (!listing || !user || listing.seller_id !== user.id) return

    // デバッグ用：ユーザーIDを確認
    console.log('Current user ID:', user.id)
    console.log('Listing seller ID:', listing.seller_id)
    console.log('IDs match:', user.id === listing.seller_id)

    setCancelLoading(true)
    try {
      // Supabaseの認証状態を確認
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
      console.log('Supabase auth user:', currentUser?.id)
      console.log('Auth error:', authError)

      // RPC関数を使用して出品を取消し
      const { error } = await supabase
        .rpc('cancel_listing', {
          listing_id: listing.id
        })

      if (error) throw error

      alert('出品を取消しました')
      router.push('/data-market')
    } catch (error: any) {
      console.error('Error canceling listing:', error)
      alert('取消しに失敗しました: ' + error.message)
    } finally {
      setCancelLoading(false)
      setShowCancelModal(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-300 rounded mb-6"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!listing) {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              データセットが見つかりません
            </h3>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700"
            >
              戻る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            データマーケットに戻る
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {listing.survey.categories?.name}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  {listing.survey.current_responses}回答
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {listing.title}
              </h1>
              
              <div className="flex items-center text-gray-600 text-sm space-x-6">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(listing.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
            </div>
            
            <div className="ml-8 text-right">
              {listing.price_type === 'free' ? (
                <div className="text-3xl font-bold text-green-600 mb-2">
                  FREE
                </div>
              ) : (
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {listing.price.toLocaleString()}pt
                </div>
              )}
              <div className="text-sm text-gray-500 mb-4">
                {listing.price_type === 'free' ? '無料データセット' : ""}
              </div>
              
              <div className="space-y-2">
                {listing.seller_id === user?.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center py-2 px-4 bg-gray-100 text-gray-600 rounded-lg font-medium">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      自分の出品
                    </div>
                    {listing.price_type === 'free' && (
                      <button
                        onClick={downloadFullData}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSVファイルをダウンロード
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-medium flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      出品を取消し
                    </button>
                  </div>
                ) : listing.price_type === 'free' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center py-2 px-4 bg-green-100 text-green-800 rounded-lg font-medium">
                      無料データセット
                    </div>
                    <button
                      onClick={downloadFullData}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSVファイルをダウンロード
                    </button>
                  </div>
                ) : isPurchased ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center py-2 px-4 bg-green-100 text-green-800 rounded-lg font-medium">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      購入済み
                    </div>
                    <button
                      onClick={downloadFullData}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSVファイルをダウンロード
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={purchaseLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium"
                  >
                    {purchaseLoading ? '購入中...' : '購入する'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: '概要' },
              { key: 'preview', label: 'データプレビュー' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* タブコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">データセットの説明</h3>
                    {user && listing.seller_id === user.id && !editMode && (
                      <button
                        onClick={startEdit}
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        編集
                      </button>
                    )}
                  </div>
                  
                  {editMode ? (
                    <div className="space-y-3">
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="データセットの説明を入力してください..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateDescription}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700 leading-relaxed">
                      {listing.description || 'データセットの説明はありません。'}
                    </p>
                  )}
                </div>

                {/* 質問とカラムの対応表 */}
                {previewData && previewData.question_mapping.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">質問とカラムの対応表</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-blue-100">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-blue-900 border-b w-20">
                                カラム
                              </th>
                              <th className="px-4 py-3 text-left font-medium text-blue-900 border-b">
                                質問内容
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.question_mapping.map((mapping, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                <td className="px-4 py-3 font-medium text-blue-800 border-b">
                                  {mapping.column_name}
                                </td>
                                <td className="px-4 py-3 text-blue-700 border-b">
                                  {mapping.question_text}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      ※CSVファイルではこれらのカラム名でデータが提供されます
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">データプレビュー</h3>
                  {previewLoading && (
                    <div className="flex items-center text-gray-500">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      読み込み中...
                    </div>
                  )}
                </div>
                
                {previewData ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        {previewData.preview_note}
                      </p>
                    </div>
                    
                    {previewData.csv_data.length > 0 ? (
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b">
                          <h4 className="font-medium text-gray-900">
                            サンプルデータ（{previewData.csv_data.length}件 / 全{previewData.total_responses}件）
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            カラムの説明は「概要」タブをご確認ください
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {previewData.csv_headers.map((header, index) => (
                                  <th key={index} className="px-4 py-2 text-left font-medium text-gray-900 border-b">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.csv_data.map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-4 py-2 text-gray-700 border-b max-w-xs truncate" title={cell}>
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border rounded-lg p-8 text-center">
                        <div className="text-gray-400 text-4xl mb-3">📄</div>
                        <h4 className="font-medium text-gray-900 mb-2">プレビューデータがありません</h4>
                        <p className="text-sm text-gray-500">
                          このデータセットにはまだ回答データが含まれていないか、<br/>
                          データベースのセットアップが必要です。
                        </p>
                      </div>
                    )}
                  </div>
                ) : !previewLoading ? (
                  <div className="bg-gray-50 border rounded-lg p-8 text-center">
                    <div className="text-gray-400 text-4xl mb-3">⏳</div>
                    <h4 className="font-medium text-gray-900 mb-2">プレビューを準備中</h4>
                    <p className="text-sm text-gray-500">
                      データのプレビューを読み込んでいます...
                    </p>
                  </div>
                ) : null}
              </div>
            )}

          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">データセット情報</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">回答数:</span>
                  <span className="font-medium">{listing.survey.current_responses}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">カテゴリ:</span>
                  <span className="font-medium">{listing.survey.categories?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">公開日:</span>
                  <span className="font-medium">
                    {new Date(listing.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">データ形式と利用について</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• CSV形式（Q1, Q2, Q3...のカラム名）</li>
                <li>• 複数選択の回答は「;」で区切り</li>
                <li>• Excel・Google Sheetsで直接利用可能</li>
                <li>• 質問内容は「概要」タブで確認可能</li>
                <li>• 個人情報は含まれていません</li>
                <li>• 分析・研究目的でご利用ください</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 取消し確認モーダル */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">出品を取消しますか？</h3>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  この操作により「{listing.title}」の出品が取消されます。
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm text-yellow-800 space-y-1">
                    <p>• 出品が非表示になります</p>
                    <p>• 購入者は新規にデータを購入できなくなります</p>
                    <p>• 既に購入済みの方には影響ありません</p>
                    <p>• この操作は元に戻せません</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCancelListing}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {cancelLoading ? '取消し中...' : '出品を取消し'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}