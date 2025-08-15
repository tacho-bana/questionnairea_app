'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row']
}
type Category = Database['public']['Tables']['categories']['Row']

export default function SurveysPage() {
  const { user } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'points_high' | 'points_low' | 'deadline_soon' | 'deadline_later'>('newest')

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (user) {
      fetchSurveys()
    }
  }, [user, selectedCategory, searchTerm, sortBy])

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

  const fetchSurveys = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('surveys')
        .select(`
          *,
          categories (*)
        `)
        .eq('status', 'active')

      // 自分が作成したアンケートは除外
      if (user) {
        query = query.neq('creator_id', user.id)
      }

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`)
      }

      // ソート条件を適用
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'oldest':
          query = query.order('created_at', { ascending: true })
          break
        case 'points_high':
          query = query.order('reward_points', { ascending: false })
          break
        case 'points_low':
          query = query.order('reward_points', { ascending: true })
          break
        case 'deadline_soon':
          query = query.order('deadline', { ascending: true })
          break
        case 'deadline_later':
          query = query.order('deadline', { ascending: false })
          break
        default:
          query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (data) {
        setSurveys(data as Survey[])
      }
    } catch (error) {
      console.error('Error fetching surveys:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                アンケート一覧
              </h1>
              <p className="text-gray-600">
                興味のあるアンケートに回答してポイントを獲得しよう
              </p>
            </div>

            {/* Search & Filter */}
            <div className="mb-8 bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                    検索
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="アンケートのタイトルで検索..."
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    カテゴリ
                  </label>
                  <select
                    id="category"
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべてのカテゴリ</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-2">
                    並び替え
                  </label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="newest">新着順</option>
                    <option value="oldest">古い順</option>
                    <option value="points_high">報酬ポイント（高い順）</option>
                    <option value="points_low">報酬ポイント（低い順）</option>
                    <option value="deadline_soon">締切が近い順</option>
                    <option value="deadline_later">締切が遠い順</option>
                  </select>
                </div>
              </div>

              {/* Results count */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <span>{surveys.length}件のアンケートが見つかりました</span>
                  </div>
                  {(selectedCategory || searchTerm) && (
                    <button
                      onClick={() => {
                        setSelectedCategory(null)
                        setSearchTerm('')
                      }}
                      className="text-blue-600 hover:text-blue-500 font-medium flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>フィルターを解除</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Sort Buttons */}
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 flex items-center mr-2">並び替え:</span>
              {[
                { key: 'newest', label: '新着順'},
                { key: 'points_high', label: '高ポイント'},
                { key: 'deadline_soon', label: '締切順'}
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSortBy(item.key as typeof sortBy)}
                  className={`
                    inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200
                    ${sortBy === item.key 
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-opacity-20' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map((survey) => (
                  <div key={survey.id} className="bg-white shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-200 border border-gray-100 hover:border-blue-200">
                    <div className="p-6">
                      {/* Category and Reward */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          {survey.categories?.name}
                        </span>
                        <div className="flex items-center space-x-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-lg shadow-sm">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span className="text-xs font-semibold">{survey.reward_points}pt</span>
                        </div>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {survey.title}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {survey.description || 'アンケートの説明がありません'}
                      </p>
                      
                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span className="font-medium">回答進捗</span>
                          <span className="font-semibold">{survey.current_responses}/{survey.max_responses}人</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((survey.current_responses / (survey.max_responses || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          残り{(survey.max_responses || 0) - survey.current_responses}人
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="space-y-1 text-sm text-gray-500 mb-4">
                        {(survey as any).deadline && (
                          <div className="flex justify-between">
                            <span>締切:</span>
                            <span>
                              {new Date((survey as any).deadline).toLocaleDateString('ja-JP', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>作成日:</span>
                          <span>{new Date(survey.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <Link
                        href={`/surveys/${survey.id}`}
                        className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-center py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        回答する
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && surveys.length === 0 && (
              <div className="text-center py-12">
                <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md mx-auto border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">アンケートが見つかりません</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || selectedCategory 
                      ? '検索条件を変更して再度お試しください' 
                      : '現在回答可能なアンケートがありません'
                    }
                  </p>
                  {(searchTerm || selectedCategory) && (
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setSelectedCategory(null)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors duration-200"
                    >
                      すべて表示
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
    </ProtectedRoute>
  )
}