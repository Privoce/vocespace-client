// webhook for stripe (rewrite use nextjs api)
// test: stripe trigger payment_intent.succeeded
import { getServerIp } from '@/lib/std';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const IP = process.env.SERVER_NAME ?? getServerIp() ?? 'localhost';
const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const WEBHOOK = process.env.WEBHOOK ?? false;

export async function POST(request: Request) {
  if (!WEBHOOK) {
    return NextResponse.json({ error: 'Webhook is not enabled' }, { status: 400 });
  }

  const stripe = new Stripe(SECRET_KEY);
  const sig: any = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      // now we get the payment intent, then send to the api server, which will store user info and generate a license value for the user
      // then the user will get a email(contain license value) from api server
      if (paymentIntentSucceeded.status === 'succeeded') {
        paySuccessAndSendToServer(paymentIntentSucceeded);
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true }, { status: 200 });
}

const paySuccessAndSendToServer = async (payInfo: Stripe.PaymentIntent) => {
  const url = 'https://space.voce.chat/api/license'; // test
  const info = {
    email: payInfo.receipt_email,
    created_at: payInfo.created,
    domains: IP,
  };
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(info),
  });
};
