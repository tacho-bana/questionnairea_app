import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            学生向けアンケート・ポイント交換プラットフォーム
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            アンケートに答えてポイントを獲得し、抽選イベントに参加しよう！
          </p>
        </div>

        <div className="flex justify-center space-x-4">
          <Link
            href="/auth"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            ログイン / 新規登録
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">アンケートに答える</h3>
            <p className="text-gray-600">
              興味のあるアンケートに答えてポイントを獲得しましょう。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">アンケートを作成</h3>
            <p className="text-gray-600">
              ポイントを消費してアンケートを作成し、回答データを収集できます。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">抽選イベント</h3>
            <p className="text-gray-600">
              獲得したポイントで抽選イベントに参加して賞品を狙いましょう。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}