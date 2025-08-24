'use client'

import { useState } from 'react'

export interface Question {
  id: string
  question_text: string
  question_type: 'text' | 'textarea' | 'multiple_choice' | 'checkbox' | 'dropdown' | 'number'
  options?: string[]
  is_required: boolean
  validation?: {
    max?: number
  }
}

interface QuestionCardProps {
  question: Question
  index: number
  onUpdate: (field: string, value: any) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}

function QuestionCard({ 
  question, 
  index, 
  onUpdate, 
  onDelete, 
  onDuplicate, 
  onMoveUp, 
  onMoveDown,
  canDelete,
  canMoveUp,
  canMoveDown
}: QuestionCardProps) {
  const addOption = () => {
    const newOptions = [...(question.options || []), '']
    onUpdate('options', newOptions)
  }

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(question.options || [])]
    newOptions[optionIndex] = value
    onUpdate('options', newOptions)
  }

  const removeOption = (optionIndex: number) => {
    const newOptions = (question.options || []).filter((_, i) => i !== optionIndex)
    onUpdate('options', newOptions)
  }

  const needsOptions = ['multiple_choice', 'checkbox', 'dropdown'].includes(question.question_type)
  const needsValidation = ['number', 'text', 'textarea'].includes(question.question_type)

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors duration-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h4 className="font-medium text-gray-900">質問 {index + 1}</h4>
        </div>

        <div className="flex items-center space-x-2">
          {canMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="上に移動"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          {canMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="下に移動"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="質問を複製"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="質問を削除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="mb-4">
        <input
          type="text"
          value={question.question_text}
          onChange={(e) => onUpdate('question_text', e.target.value)}
          className="w-full text-lg border-none border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none"
          placeholder="質問を入力"
          required
        />
      </div>

      {/* Question Type and Required Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <select
            value={question.question_type}
            onChange={(e) => onUpdate('question_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="text">記述式（短文）</option>
            <option value="textarea">記述式（長文）</option>
            <option value="multiple_choice">ラジオボタン</option>
            <option value="checkbox">チェックボックス</option>
            <option value="dropdown">プルダウン</option>
            <option value="number">数値入力</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={question.is_required}
              onChange={(e) => onUpdate('is_required', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">必須</span>
          </label>
        </div>
      </div>

      {/* Options for choice questions */}
      {needsOptions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">選択肢</span>
            <button
              type="button"
              onClick={addOption}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + 選択肢を追加
            </button>
          </div>
          
          <div className="space-y-2">
            {(question.options || []).map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  {question.question_type === 'multiple_choice' && (
                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                  )}
                  {question.question_type === 'checkbox' && (
                    <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                  )}
                  {question.question_type === 'dropdown' && (
                    <span className="text-gray-400 text-sm w-6 text-right">{optionIndex + 1}.</span>
                  )}
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(optionIndex, e.target.value)}
                  placeholder={`選択肢を入力`}
                  className="flex-1 px-2 py-1 border-none border-b border-gray-200 focus:border-blue-500 focus:outline-none bg-transparent"
                />
                {(question.options?.length || 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation for number/text inputs */}
      {needsValidation && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">入力制限</span>
          </div>
          <div className="w-full">
            {question.question_type === 'number' && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">最大値</label>
                <input
                  type="number"
                  value={question.validation?.max || ''}
                  onChange={(e) => onUpdate('validation', { 
                    max: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="例: 100"
                />
              </div>
            )}
            {(question.question_type === 'text' || question.question_type === 'textarea') && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">最大文字数</label>
                <input
                  type="number"
                  value={question.validation?.max || ''}
                  onChange={(e) => onUpdate('validation', { 
                    max: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="例: 500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface SurveyBuilderSimpleProps {
  questions: Question[]
  onQuestionsChange: (questions: Question[]) => void
}

export default function SurveyBuilderSimple({ questions, onQuestionsChange }: SurveyBuilderSimpleProps) {
  const addQuestion = () => {
    const newQuestion: Question = {
      id: `question-${Date.now()}`,
      question_text: '',
      question_type: 'text',
      options: [],
      is_required: true,
    }
    onQuestionsChange([...questions, newQuestion])
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    const updatedQuestions = questions.map((q, i) => {
      if (i === index) {
        const updated = { ...q, [field]: value }
        
        // Reset options when changing to non-choice type
        if (field === 'question_type' && !['multiple_choice', 'checkbox', 'dropdown'].includes(value)) {
          updated.options = []
          updated.validation = undefined
        }
        // Initialize options for choice types
        else if (field === 'question_type' && ['multiple_choice', 'checkbox', 'dropdown'].includes(value) && !updated.options?.length) {
          updated.options = ['', '']
        }
        // Reset validation when changing question type
        else if (field === 'question_type') {
          updated.validation = undefined
        }
        
        return updated
      }
      return q
    })
    onQuestionsChange(updatedQuestions)
  }

  const duplicateQuestion = (index: number) => {
    const questionToDuplicate = questions[index]
    const duplicatedQuestion: Question = {
      ...questionToDuplicate,
      id: `question-${Date.now()}`,
      question_text: questionToDuplicate.question_text + ' (コピー)',
    }
    const newQuestions = [...questions]
    newQuestions.splice(index + 1, 0, duplicatedQuestion)
    onQuestionsChange(newQuestions)
  }

  const deleteQuestion = (index: number) => {
    if (questions.length > 1) {
      const updatedQuestions = questions.filter((_, i) => i !== index)
      onQuestionsChange(updatedQuestions)
    }
  }

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const newQuestions = [...questions]
    const [removed] = newQuestions.splice(fromIndex, 1)
    newQuestions.splice(toIndex, 0, removed)
    onQuestionsChange(newQuestions)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">質問設定</h3>
        <button
          type="button"
          onClick={addQuestion}
          className="bg-blue-400 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>質問を追加</span>
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            onUpdate={(field, value) => updateQuestion(index, field, value)}
            onDelete={() => deleteQuestion(index)}
            onDuplicate={() => duplicateQuestion(index)}
            onMoveUp={() => moveQuestion(index, index - 1)}
            onMoveDown={() => moveQuestion(index, index + 1)}
            canDelete={questions.length > 1}
            canMoveUp={index > 0}
            canMoveDown={index < questions.length - 1}
          />
        ))}
      </div>
    </div>
  )
}