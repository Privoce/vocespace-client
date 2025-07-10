// webhook for stripe (rewrite use nextjs api)
// test: stripe trigger payment_intent.succeeded
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const WEBHOOK = process.env.WEBHOOK ?? false;

// 为用户侧构建一个stripe session, 让用户跳转到stripe的支付页面
// 参数: session_ip=IP
export async function GET(request: NextRequest) {
  if (!WEBHOOK) {
    return NextResponse.json({ error: 'Webhook is not enabled' }, { status: 400 });
  }
  const stripe = new Stripe(SECRET_KEY);
  const ip = request.nextUrl.searchParams.get('session_ip');
  if (!ip) {
    return NextResponse.json({ error: 'session_ip is required' }, { status: 400 });
  } else {
    // 创建session, product: prod_S8YXSKlgQvaYdH, price: price_1REHPyGGoUDRyc3jW5AlM49w
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // mode: "subscription",
        payment_method_types: [
          'card',
          'alipay',
          'link',
          'wechat_pay',
          // 'klarna',
          'cashapp',
        ],
        payment_method_options: {
          wechat_pay: {
            client: 'web',
          },
        },
        line_items: [
          {
            price: 'price_1REHPyGGoUDRyc3jW5AlM49w',
            quantity: 1,
          },
        ],
        metadata: {
          server_ip: ip,
        },
        // default success url
        success_url: 'https://vocespace.com',
      });
      return NextResponse.json({ url: session.url }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
  }
}

export async function POST(request: Request) {
  if (!WEBHOOK) {
    return NextResponse.json({ error: 'Webhook is not enabled' }, { status: 400 });
  }

  const stripe = new Stripe(SECRET_KEY);
  const sig: any = request.headers.get('stripe-signature');
  const rawBody = await request.arrayBuffer();
  const body = Buffer.from(rawBody);

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
        // paySuccessAndSendToServer(paymentIntentSucceeded);
        // console.warn(paymentIntentSucceeded);
      }

      break;
    case 'checkout.session.completed':
      const session = event.data.object;
      // Now you have the session object, you can use it to send the license to the user
      if (session.payment_status === 'paid' && session.status === 'complete') {
        let domains = '';
        if (session.metadata && session.metadata['server_ip']) {
          domains = session.metadata['server_ip'];
        } else if (
          session.custom_fields &&
          session.custom_fields[0] &&
          session.custom_fields[0].text?.value
        ) {
          domains = session.custom_fields[0].text?.value;
        }

        if (session.customer_email) {
          paySuccessAndSendToServer({
            email: session.customer_email,
            created: session.created,
            domains,
          });
        }
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ status: 200 }, { status: 200 });
}

const paySuccessAndSendToServer = async ({
  email,
  created,
  domains,
}: {
  email: string;
  created: number;
  domains: string;
}) => {
  const url = 'https://space.voce.chat/api/license'; // test
  const info = {
    email,
    created_at: created,
    domains,
  };
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(info),
  });
};
