'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Report = Database['public']['Tables']['reports']['Row'] & {
  reporter: Database['public']['Tables']['users']['Row']
  reported_user: Database['public']['Tables']['users']['Row']
}

export default function AdminPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Note: This is a basic admin check. In production, you'd have proper role-based access control
  const isAdmin = user?.email === 'admin@example.com' // Replace with your admin email

  useEffect(() => {
    if (user && isAdmin) {
      fetchReports()
    }
  }, [user, isAdmin])

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:users!reports_reporter_id_fkey (username, email),
          reported_user:users!reports_reported_user_id_fkey (username, email)
        `)
        .order('created_at', { ascending: false })

      if (data) {
        setReports(data as Report[])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReportAction = async (reportId: string, action: 'resolved' | 'dismissed') => {
    setActionLoading(reportId)

    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: action })
        .eq('id', reportId)

      if (error) throw error

      // Refresh reports
      fetchReports()
      alert(`通報を${action === 'resolved' ? '解決済み' : '却下'}にしました`)

    } catch (error: any) {
      console.error('Error updating report:', error)
      alert('エラーが発生しました: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBanUser = async (userId: string, username: string) => {
    if (!confirm(`${username} をBANしますか？`)) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: true })
        .eq('id', userId)

      if (error) throw error

      alert(`${username} をBANしました`)
      fetchReports()

    } catch (error: any) {
      console.error('Error banning user:', error)
      alert('BANに失敗しました: ' + error.message)
    }
  }

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="max-w-7xl mx-auto py-6 px-4">
            <div className="text-center py-12">
              <div className="text-red-400 text-6xl mb-4">🚫</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                アクセス権限がありません
              </h3>
              <p className="text-gray-500">
                管理者のみアクセス可能です。
              </p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">管理画面</h1>
              <div className="text-sm text-gray-600">
                通報処理とユーザー管理
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {reports.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      処理待ちの通報がありません
                    </h3>
                    <p className="text-gray-500">
                      新しい通報があると、ここに表示されます。
                    </p>
                  </div>
                ) : (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                      {reports.map((report) => (
                        <li key={report.id}>
                          <div className="px-4 py-6 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-blue-600 truncate">
                                    {report.reason}
                                  </p>
                                  <div className="ml-2 flex-shrink-0 flex">
                                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      report.status === 'pending' 
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : report.status === 'resolved'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {report.status === 'pending' ? '保留中' : 
                                       report.status === 'resolved' ? '解決済み' : '却下'}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                  <div className="sm:flex sm:space-x-6">
                                    <p className="flex items-center text-sm text-gray-500">
                                      <span className="font-medium">通報者:</span>
                                      <span className="ml-1">{report.reporter?.username}</span>
                                    </p>
                                    <p className="flex items-center text-sm text-gray-500">
                                      <span className="font-medium">被通報者:</span>
                                      <span className="ml-1">{report.reported_user?.username}</span>
                                    </p>
                                    <p className="flex items-center text-sm text-gray-500">
                                      <span className="font-medium">種類:</span>
                                      <span className="ml-1">{report.reported_content_type}</span>
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                    <p>
                                      {new Date(report.created_at).toLocaleDateString('ja-JP')}
                                    </p>
                                  </div>
                                </div>
                                {report.description && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                    <p className="text-sm text-gray-700">
                                      <span className="font-medium">詳細:</span> {report.description}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {report.status === 'pending' && (
                              <div className="mt-4 flex space-x-3">
                                <button
                                  onClick={() => handleReportAction(report.id, 'resolved')}
                                  disabled={actionLoading === report.id}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                >
                                  {actionLoading === report.id ? '処理中...' : '解決済みにする'}
                                </button>
                                <button
                                  onClick={() => handleReportAction(report.id, 'dismissed')}
                                  disabled={actionLoading === report.id}
                                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                  {actionLoading === report.id ? '処理中...' : '却下する'}
                                </button>
                                <button
                                  onClick={() => handleBanUser(
                                    report.reported_user_id!, 
                                    report.reported_user?.username || 'Unknown'
                                  )}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  ユーザーをBAN
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="mt-12 bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-red-900 mb-2">管理者機能について</h3>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• ユーザーからの通報を確認・処理できます</li>
                <li>• 悪質なユーザーをBANすることができます</li>
                <li>• 処理した通報は履歴として残ります</li>
                <li>• BANされたユーザーはサービスを利用できなくなります</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}