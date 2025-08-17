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

// Read the SQL schema file
const sqlContent = fs.readFileSync('data_market_schema.sql', 'utf8')

async function executeSchema() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('Connecting to Supabase...')
  
  try {
    // Split SQL by statements (basic approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`Executing ${statements.length} SQL statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`)
        console.log(`Statement: ${statement.substring(0, 100)}...`)
        
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        })
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error)
          // Try direct query instead
          const { error: queryError } = await supabase.from('information_schema.tables').select('*').limit(1)
          if (queryError) {
            console.error('Cannot execute SQL through Supabase client. Database may need direct access.')
            return
          }
        } else {
          console.log(`Statement ${i + 1} executed successfully`)
        }
      }
    }
    
    console.log('Schema execution completed!')
    
  } catch (error) {
    console.error('Error executing schema:', error)
  }
}

executeSchema()