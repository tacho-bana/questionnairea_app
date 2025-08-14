'use client'

import { useState } from 'react'
import { Question } from './SurveyBuilder'

interface SurveyPreviewProps {
  title: string
  description: string
  questions: Question[]
  rewardPoints: number
}

export default function SurveyPreview({ title, description, questions, rewardPoints }: SurveyPreviewProps) {
  const [responses, setResponses] = useState<Record<string, any>>({})

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const renderQuestion = (question: Question, index: number) => {
    const questionId = question.id

    switch (question.question_type) {
      case 'text':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
              maxLength={question.validation?.max}
            />
            {question.validation?.max && (
              <p className="text-xs text-gray-500 mt-1">
                最大${question.validation.max}文字
              </p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
              maxLength={question.validation?.max}
            />
            {question.validation?.max && (
              <p className="text-xs text-gray-500 mt-1">
                最大${question.validation.max}文字
              </p>
            )}
          </div>
        )

      case 'number':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="数値を入力してください"
              max={question.validation?.max}
            />
            {question.validation?.max !== undefined && (
              <p className="text-xs text-gray-500 mt-1">
                ${question.validation.max}以下
              </p>
            )}
          </div>
        )


      case 'multiple_choice':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {(question.options || []).map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center">
                  <input
                    type="radio"
                    name={questionId}
                    value={option}
                    checked={responses[questionId] === option}
                    onChange={(e) => handleResponseChange(questionId, e.target.value)}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        )

      case 'checkbox':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {(question.options || []).map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center">
                  <input
                    type="checkbox"
                    value={option}
                    checked={(responses[questionId] || []).includes(option)}
                    onChange={(e) => {
                      const currentValues = responses[questionId] || []
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter((v: string) => v !== option)
                      handleResponseChange(questionId, newValues)
                    }}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        )

      case 'dropdown':
        return (
          <div key={questionId} className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">選択してください</option>
              {(question.options || []).map((option, optionIndex) => (
                <option key={optionIndex} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )


      default:
        return null
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {/* Survey Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            プレビュー
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            報酬: {rewardPoints}pt
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {title || 'アンケートタイトル'}
        </h1>

        {description && (
          <p className="text-gray-600 mb-4">
            {description}
          </p>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-blue-400 text-xl mr-3">ℹ️</div>
            <div>
              <h4 className="text-blue-900 font-medium mb-1">回答について</h4>
              <p className="text-blue-800 text-sm">
                すべての質問に回答してください。回答後、{rewardPoints}ポイントが獲得できます。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {questions.length > 0 ? (
          questions.map((question, index) => renderQuestion(question, index))
        ) : (
          <div className="text-center py-12 text-gray-500">
            質問を追加してプレビューを確認してください
          </div>
        )}
      </div>

      {/* Submit Button */}
      {questions.length > 0 && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled
            className="px-6 py-2 bg-blue-600 text-white rounded-md opacity-50 cursor-not-allowed"
          >
            回答を送信 (プレビュー)
          </button>
        </div>
      )}
    </div>
  )
}