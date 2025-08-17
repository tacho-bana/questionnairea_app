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

  useEffect(() => {
    if (id) {
      fetchListingData()
      checkPurchaseStatus()
    }
  }, [id, user])

  // リスティングデータが読み込まれた後にプレビューデータを取得
  useEffect(() => {
    if (listing) {
      fetchPreviewData()
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
    if (!user) return

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

      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('id, submitted_at, responses')
        .eq('survey_id', surveyId)
        .limit(3)

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

      const preview: PreviewData = {
        survey_title: listing?.title || 'データセット',
        total_responses: listing?.survey?.current_responses || responses?.length || 0,
        preview_note: '※これは最初の3件のプレビューです。実際のデータセットにはすべての回答が含まれます。',
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
    if (!listing || !isPurchased) return

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
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  {listing.total_sales}販売済
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {listing.title}
              </h1>
              
              <div className="flex items-center text-gray-600 text-sm space-x-6">
                <div className="flex items-center">
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
            
            <div className="ml-8 text-right">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {listing.price.toLocaleString()}pt
              </div>
              <div className="text-sm text-gray-500 mb-4">
                作成者収益: {listing.revenue_per_sale}pt
              </div>
              
              <div className="space-y-2">
                {isPurchased ? (
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
                ) : listing.seller_id === user?.id ? (
                  <button
                    disabled
                    className="w-full bg-gray-400 text-white py-3 px-6 rounded-lg font-medium cursor-not-allowed"
                  >
                    自分の出品
                  </button>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">データセットの説明</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {listing.description || 'データセットの説明はありません。'}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">アンケート詳細</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {listing.survey.description || 'アンケートの説明はありません。'}
                  </p>
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
                  <span className="text-gray-500">販売実績:</span>
                  <span className="font-medium">{listing.total_sales}件</span>
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
      </div>
    </ProtectedRoute>
  )
}