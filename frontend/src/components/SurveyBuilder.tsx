'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface Question {
  id: string
  question_text: string
  question_type: 'text' | 'textarea' | 'multiple_choice' | 'checkbox' | 'rating' | 'dropdown' | 'date' | 'email' | 'number'
  options?: string[]
  is_required: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

interface QuestionCardProps {
  question: Question
  index: number
  onUpdate: (field: string, value: any) => void
  onDelete: () => void
  onDuplicate: () => void
  canDelete: boolean
}

function QuestionCard({ question, index, onUpdate, onDelete, onDuplicate, canDelete }: QuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors duration-200 ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      {/* Drag Handle and Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <button
            {...attributes}
            {...listeners}
            className="p-2 text-gray-400 hover:text-gray-600 cursor-move"
            title="ドラッグして順序変更"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" />
            </svg>
          </button>
          <h4 className="font-medium text-gray-900">質問 {index + 1}</h4>
        </div>

        <div className="flex items-center space-x-2">
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
          className="w-full text-lg border-none border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none pb-2 bg-transparent"
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
            <option value="rating">段階評価</option>
            <option value="number">数値入力</option>
            <option value="email">メールアドレス</option>
            <option value="date">日付</option>
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
                    <span className="text-gray-400 text-sm">{optionIndex + 1}.</span>
                  )}
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(optionIndex, e.target.value)}
                  placeholder={`選択肢 ${optionIndex + 1}`}
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
          <div className="grid grid-cols-2 gap-4">
            {question.question_type === 'number' && (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最小値</label>
                  <input
                    type="number"
                    value={question.validation?.min || ''}
                    onChange={(e) => onUpdate('validation', { 
                      ...question.validation, 
                      min: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="例: 0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大値</label>
                  <input
                    type="number"
                    value={question.validation?.max || ''}
                    onChange={(e) => onUpdate('validation', { 
                      ...question.validation, 
                      max: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="例: 100"
                  />
                </div>
              </>
            )}
            {(question.question_type === 'text' || question.question_type === 'textarea') && (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最小文字数</label>
                  <input
                    type="number"
                    value={question.validation?.min || ''}
                    onChange={(e) => onUpdate('validation', { 
                      ...question.validation, 
                      min: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="例: 10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大文字数</label>
                  <input
                    type="number"
                    value={question.validation?.max || ''}
                    onChange={(e) => onUpdate('validation', { 
                      ...question.validation, 
                      max: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="例: 500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rating preview */}
      {question.question_type === 'rating' && (
        <div className="mt-4">
          <span className="text-sm text-gray-600 block mb-2">プレビュー:</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">1</span>
            {[1, 2, 3, 4, 5].map((rating) => (
              <div key={rating} className="w-8 h-8 border-2 border-gray-300 rounded-full flex items-center justify-center text-sm">
                {rating}
              </div>
            ))}
            <span className="text-sm text-gray-500">5</span>
          </div>
        </div>
      )}

      {/* Preview for other question types */}
      {(question.question_type === 'text' || question.question_type === 'textarea' || 
        question.question_type === 'number' || question.question_type === 'email' || 
        question.question_type === 'date') && (
        <div className="mt-4">
          <span className="text-sm text-gray-600 block mb-2">プレビュー:</span>
          {question.question_type === 'textarea' ? (
            <textarea
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              rows={3}
              placeholder="回答者の入力エリア"
            />
          ) : question.question_type === 'date' ? (
            <input
              type="date"
              disabled
              className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          ) : question.question_type === 'email' ? (
            <input
              type="email"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              placeholder="example@email.com"
            />
          ) : question.question_type === 'number' ? (
            <input
              type="number"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              placeholder={`数値入力${question.validation?.min !== undefined ? ` (${question.validation.min}以上)` : ''}${question.validation?.max !== undefined ? ` (${question.validation.max}以下)` : ''}`}
            />
          ) : (
            <input
              type="text"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              placeholder="回答者の入力エリア"
            />
          )}
        </div>
      )}
    </div>
  )
}

interface SurveyBuilderProps {
  questions: Question[]
  onQuestionsChange: (questions: Question[]) => void
}

export default function SurveyBuilder({ questions, onQuestionsChange }: SurveyBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id)
      const newIndex = questions.findIndex((q) => q.id === over?.id)

      onQuestionsChange(arrayMove(questions, oldIndex, newIndex))
    }
  }

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
          updated.options = ['選択肢1', '選択肢2']
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">質問設定</h3>
        <button
          type="button"
          onClick={addQuestion}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>質問を追加</span>
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                onUpdate={(field, value) => updateQuestion(index, field, value)}
                onDelete={() => deleteQuestion(index)}
                onDuplicate={() => duplicateQuestion(index)}
                canDelete={questions.length > 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}