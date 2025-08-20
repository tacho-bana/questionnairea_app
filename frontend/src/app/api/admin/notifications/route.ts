import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Environment check:', {
  supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
  supabaseServiceKey: supabaseServiceKey ? 'Set' : 'Missing'
})

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
}

// サービスロールキーを使用したクライアント（RLS制限なし）
const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

export async function POST(request: NextRequest) {
  console.log('POST /api/admin/notifications called')
  
  try {
    // 環境変数チェック
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // 認証確認（Authorizationヘッダーまたはクッキーから）
    let session = null
    let user = null

    try {
      // Authorizationヘッダーからアクセストークンを取得
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.substring(7)
        console.log('Using Authorization header')
        
        // アクセストークンからユーザー情報を取得
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
        
        if (userError) {
          console.error('Error getting user from token:', userError)
        } else {
          user = userData.user
          console.log('User from token:', { email: user?.email })
        }
      }
      
      // トークンから取得できない場合はクッキーを試す
      if (!user) {
        console.log('Trying cookie-based authentication')
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session: cookieSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
        } else if (cookieSession?.user) {
          user = cookieSession.user
          session = cookieSession
          console.log('User from cookie:', { email: user.email })
        }
      }
      
      if (!user) {
        console.log('No user found from either method')
        return NextResponse.json({ error: 'Unauthorized - No user found' }, { status: 401 })
      }

      // 管理者権限確認
      const isAdmin = user.email === 'yuto0421tachi@gmail.com'
      console.log('Admin check:', { email: user.email, isAdmin })
      
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    } catch (authError) {
      console.error('Authentication error:', authError)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // リクエストボディを取得
    const body = await request.json()
    console.log('Request body:', body)
    
    const { title, content, type, reward_points, claim_deadline } = body

    // バリデーション
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    // お知らせを作成（サービスロールキーを使用してRLS制限を回避）
    console.log('Creating notification...')
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([{
        title,
        content,
        type: type || 'info',
        is_global: true,
        is_active: true,
        reward_points: reward_points || 0,
        current_claims: 0,
        claim_deadline: claim_deadline || null
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return NextResponse.json({ error: 'Failed to create notification', details: error }, { status: 500 })
    }

    console.log('Notification created successfully:', data)
    return NextResponse.json({ data }, { status: 201 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}