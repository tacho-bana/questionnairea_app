'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'

interface ProfileSetupProps {
  onComplete: () => void
  isOptional?: boolean
}

export default function ProfileSetup({ onComplete, isOptional = false }: ProfileSetupProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    gender: '',
    birth_date: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({
    gender: '',
    birth_date: ''
  })

  const validateForm = () => {
    const newErrors = {
      gender: '',
      birth_date: ''
    }

    if (!formData.gender) {
      newErrors.gender = '性別を選択してください'
    }

    if (!formData.birth_date) {
      newErrors.birth_date = '生年月日を入力してください'
    } else {
      const birthDate = new Date(formData.birth_date)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      if (age < 13) {
        newErrors.birth_date = '13歳以上である必要があります'
      }
    }

    setErrors(newErrors)
    return !newErrors.gender && !newErrors.birth_date
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // プロフィール情報を更新
      const { error: updateError } = await supabase
        .from('users')
        .update({
          gender: formData.gender,
          birth_date: formData.birth_date,
          profile_completed: true
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // プロフィール完了ボーナスを付与
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
    } catch (error: any) {
      console.error('Error updating profile:', error)
      alert('プロフィールの更新に失敗しました: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8" style={{ backgroundColor: 'white' }}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">プロフィール設定</h2>
          <p className="text-gray-600 mb-4 leading-relaxed">
            サービス利用のために、以下の情報をご入力ください。<br />
            入力いただいた情報は統計目的でのみ使用されます。
          </p>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <p className="text-green-800 font-semibold">
                プロフィール完了で500ポイント獲得！
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              性別 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.gender}
              onChange={(e) => {
                setFormData({ ...formData, gender: e.target.value })
                if (errors.gender) {
                  setErrors({ ...errors, gender: '' })
                }
              }}
              className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none ${
                errors.gender 
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                  : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
              }`}
            >
              <option value="">性別を選択してください</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
              <option value="prefer_not_to_say">回答しない</option>
            </select>
            {errors.gender && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.gender}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              生年月日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => {
                setFormData({ ...formData, birth_date: e.target.value })
                if (errors.birth_date) {
                  setErrors({ ...errors, birth_date: '' })
                }
              }}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none ${
                errors.birth_date 
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                  : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
              }`}
            />
            {errors.birth_date && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.birth_date}
              </p>
            )}
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting || !formData.gender || !formData.birth_date}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span>保存中...</span>
                </div>
              ) : (
                'プロフィールを完了する'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}