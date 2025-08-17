const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read environment variables from frontend .env.local
const envContent = fs.readFileSync('frontend/.env.local', 'utf8')
const lines = envContent.split('\n')
let SUPABASE_URL, SUPABASE_ANON_KEY

lines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    SUPABASE_URL = line.split('=')[1]
  } else if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    SUPABASE_ANON_KEY = line.split('=')[1]
  }
})

async function checkTables() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('Checking if data marketplace tables exist...')
  
  try {
    // Try to query the data_market_listings table
    const { data: listings, error: listingsError } = await supabase
      .from('data_market_listings')
      .select('*')
      .limit(1)
    
    if (listingsError) {
      console.log('data_market_listings table does not exist:', listingsError.message)
    } else {
      console.log('data_market_listings table exists!')
    }
    
    // Try to query the data_purchases table
    const { data: purchases, error: purchasesError } = await supabase
      .from('data_purchases')
      .select('*')
      .limit(1)
    
    if (purchasesError) {
      console.log('data_purchases table does not exist:', purchasesError.message)
    } else {
      console.log('data_purchases table exists!')
    }
    
    // Try to call the RPC function
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('update_listing_sales', {
        listing_id: '00000000-0000-0000-0000-000000000000',
        revenue_amount: 0
      })
    
    if (rpcError) {
      console.log('update_listing_sales function does not exist:', rpcError.message)
    } else {
      console.log('update_listing_sales function exists!')
    }
    
  } catch (error) {
    console.error('Error checking tables:', error)
  }
}

checkTables()