import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dacjbzwqomrpwvdbxjtt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhY2piendxb21ycHd2ZGJ4anR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzU4MDcsImV4cCI6MjA5NjcxMTgwN30.xDaQmWypPVHSMh5MQTDkm573DZk6RnZLqM8-mJSioEU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type User = {
  id: string
  email: string
}
