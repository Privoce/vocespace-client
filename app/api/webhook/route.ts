// webhook for stripe (rewrite use nextjs api)
// test: stripe trigger payment_intent.succeeded
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createLicense } from '@/lib/db/license';
import { sendEmail, fmtContentBuy } from '@/lib/email';
import { getConfig, setConfigRoomLicense, writeBackConfig } from '@/app/api/conf/conf';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const WEBHOOK = process.env.WEBHOOK ?? false;

const SITE_URL = process.env.SITE_URL || 'https://vocespace.com';
const VOCESPACE_API = 'https://vocespace.com';

// 为用户侧构建一个stripe session, 让用户跳转到stripe的支付页面
// 参数: session_ip=IP
export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get('session_ip');
  const licenseType = request.nextUrl.searchParams.get('license_type') || 'room';
  if (!ip) {
    return NextResponse.json({ error: 'session_ip is required' }, { status: 400 });
  }

  // WEBHOOK=false 时，代理到 vocespace.com 处理
  if (!WEBHOOK) {
    const proxyUrl = `${VOCESPACE_API}/api/webhook?session_ip=${encodeURIComponent(ip)}`;
    const proxyRes = await fetch(proxyUrl, { method: 'GET' });
    const data = await proxyRes.json();
    return NextResponse.json(data, { status: proxyRes.status });
  }

  const stripe = new Stripe(SECRET_KEY);
  // 创建session, product: prod_S8YXSKlgQvaYdH, 
  // pro证书: price_1REHPyGGoUDRyc3jW5AlM49w
  // room证书: price_1TqCPGGGoUDRyc3jjpRg67VD
  // 测试：price_1TrfgNGGoUDRyc3jDRy4VJke
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
          // price: licenseType === 'pro' ? 'price_1REHPyGGoUDRyc3jW5AlM49w' : 'price_1TqCPGGGoUDRyc3jjpRg67VD',
          price: 'price_1TrfgNGGoUDRyc3jDRy4VJke',
          quantity: 1,
        },
      ],
      metadata: {
        server_ip: ip,
        license_type: licenseType,
      },
      success_url: SITE_URL,
    });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!WEBHOOK) {
    return NextResponse.json({ error: 'Webhook is not enabled' }, { status: 400 });
  }
  // 验证stripe webhook signature
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
      if (paymentIntentSucceeded.status === 'succeeded') {
        // 可在此处处理payment_intent逻辑
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

        const licenseType = session.metadata?.license_type || 'pro';
        if (licenseType === 'room') {
          // 房间证书：生成 license 并写入配置
          const email = session.customer_email || '';
          const created = session.created;
          const serverIp = session.metadata?.server_ip || '';
          const license = await createLicense(email, domains, created, 'room', serverIp);
          // 使用 server_ip 作为房间名写入 config
          if (serverIp) {
            setConfigRoomLicense(license.value, serverIp);
          }
          try {
            await sendEmail(
              'han@privoce.com',
              email,
              'VoceSpace Room License',
              fmtContentBuy(license.value),
            );
          } catch (err) {
            console.error('Failed to send room license email:', err);
          }
        } else {
          if (session.customer_email) {
            // 直接调用本地 license 创建逻辑，不再请求外部服务器
            paySuccessAndSendToServer({
              email: session.customer_email,
              created: session.created,
              domains,
            });
          }
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
  try {
    const license = await createLicense(email, domains, created);
    // 通过 smtp 发送邮件给用户
    const sent = await sendEmail(
      'han@privoce.com',
      email,
      'VoceSpace License',
      fmtContentBuy(license.value),
    );
    if (!sent) {
      console.error(`Failed to send license email to ${email}`);
    }
  } catch (err) {
    console.error('Failed to create license from webhook:', err);
  }
};
