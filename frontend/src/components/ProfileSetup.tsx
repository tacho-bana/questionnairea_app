'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'

interface ProfileSetupProps {
  onComplete: () => void
  isOptional?: boolean
}

export default function ProfileSetup({ onComplete, isOptional = true }: ProfileSetupProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    gender: '',
    birth_date: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    setIsSubmitting(true)

    try {
      // プロフィール情報を更新
      const { error: updateError } = await supabase
        .from('users')
        .update({
          gender: formData.gender || null,
          birth_date: formData.birth_date || null,
          profile_completed: true
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // プロフィール完了ボーナスを付与（両方入力した場合のみ）
      if (formData.gender && formData.birth_date) {
        // 既にボーナスを受け取っているかチェック
        const { data: existingBonus } = await supabase
          .from('point_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('transaction_type', 'profile_bonus')
          .limit(1)

        if (!existingBonus || existingBonus.length === 0) {
          // ボーナスポイント取引を記録
          const { error: transactionError } = await supabase
            .from('point_transactions')
            .insert([
              {
                user_id: user.id,
                amount: 500,
                transaction_type: 'profile_bonus',
                description: 'プロフィール完了ボーナス'
              }
            ])

          if (transactionError) throw transactionError

          // ユーザーのポイントを更新
          const { error: pointsError } = await supabase
            .rpc('increment_user_points', {
              user_id: user.id,
              amount: 500
            })

          if (pointsError) throw pointsError

          // リアルタイムでポイント更新を反映するために少し待つ
          setTimeout(() => {
            // キャッシュをクリアしてポイント更新を保証
            const cacheKey = `userProfile_${user.id}`
            localStorage.removeItem(cacheKey)
            alert('プロフィール設定が完了しました！\n500ポイントのボーナスを獲得しました🎉')
            onComplete()
          }, 1000)
        } else {
          alert('プロフィール設定が完了しました！')
          onComplete()
        }
      } else {
        alert('プロフィール設定を保存しました。')
        onComplete()
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      alert('プロフィールの更新に失敗しました: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: 'white' }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">プロフィール設定</h2>
          <p className="text-sm text-gray-600 mb-2">
            より良いアンケート体験のために、基本情報を教えてください
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              🎁 両方入力すると500ポイント獲得！
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              性別 <span className="text-gray-500">(任意)</span>
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">選択してください</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
              <option value="prefer_not_to_say">回答しない</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生年月日 <span className="text-gray-500">(任意)</span>
            </label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            {isOptional && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
              >
                スキップ
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center pt-2">
            この情報は統計目的でのみ使用され、個人を特定することはありません
          </div>
        </form>
      </div>
    </div>
  )
}