import Stripe from 'npm:stripe@16'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe          = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const webhookSecret   = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

// Service-role client — bypasses RLS so it can write to profiles
const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const sig  = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch {
    return new Response('Webhook signature invalid', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.user_id
      if (userId && session.payment_status === 'paid') {
        await adminSupabase.from('profiles').update({
          is_premium: true,
          stripe_customer_id: String(session.customer),
        }).eq('user_id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = String(sub.customer)
      await adminSupabase.from('profiles').update({ is_premium: false })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = String(sub.customer)
      const active     = sub.status === 'active'
      await adminSupabase.from('profiles').update({ is_premium: active })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
