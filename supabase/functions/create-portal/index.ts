import Stripe from 'npm:stripe@16'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const APP_URL  = Deno.env.get('APP_URL')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return json({ error: 'Unauthorized' }, 401)

    // Look up the Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.stripe_customer_id) return json({ error: 'No subscription found' }, 400)

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: APP_URL,
    })

    return json({ url: portalSession.url })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
