// webhook for stripe (rewrite use nextjs api)
// test: stripe trigger payment_intent.succeeded
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createLicense } from '@/lib/db/license';
import { sendEmail, fmtContentBuy, fmtContentCancel } from '@/lib/email';
import { getConfig, setConfigRoomLicense, writeBackConfig } from '@/app/api/conf/conf';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const WEBHOOK = process.env.WEBHOOK ?? false;

const SITE_URL = process.env.SITE_URL || 'https://vocespace.com';
const VOCESPACE_API = 'https://vocespace.com';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
] as const);

type StripeSubscriptionLike = Stripe.Subscription;
type ActiveSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'paused';

function isActiveSubscriptionStatus(
  status: Stripe.Subscription.Status,
): status is ActiveSubscriptionStatus {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status as ActiveSubscriptionStatus);
}

function getSubscriptionCurrentPeriodEnd(subscription: StripeSubscriptionLike): number | null {
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');

  if (itemPeriodEnds.length === 0) {
    return null;
  }

  return Math.max(...itemPeriodEnds);
}

function pickCurrentSubscription(
  subscriptions: StripeSubscriptionLike[],
  sessionIp: string,
  licenseType: string,
) {
  const normalizedSessionIp = sessionIp.trim().toLowerCase();
  const normalizedLicenseType = licenseType.trim().toLowerCase();

  const cancellableSubscriptions = subscriptions.filter(
    (subscription) => !subscription.cancel_at_period_end,
  );

  const metadataMatched = cancellableSubscriptions.find((subscription) => {
    const subscriptionServerIp = subscription.metadata?.server_ip?.trim().toLowerCase();
    const subscriptionLicenseType = subscription.metadata?.license_type?.trim().toLowerCase();
    return (
      subscriptionServerIp === normalizedSessionIp &&
      subscriptionLicenseType === normalizedLicenseType
    );
  });

  if (metadataMatched) {
    return metadataMatched;
  }

  if (cancellableSubscriptions.length === 1) {
    return cancellableSubscriptions[0];
  }

  const exactServerMatched = cancellableSubscriptions.find(
    (subscription) => subscription.metadata?.server_ip?.trim().toLowerCase() === normalizedSessionIp,
  );

  return exactServerMatched ?? null;
}

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

export async function DELETE(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get('session_ip');
  const email = request.nextUrl.searchParams.get('email');
  const licenseType = request.nextUrl.searchParams.get('license_type') || 'room';
  const returnUrl = request.nextUrl.searchParams.get('return_url') || SITE_URL;

  if (!ip) {
    return NextResponse.json({ error: 'session_ip is required' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  if (!WEBHOOK) {
    const proxyUrl = new URL(`${VOCESPACE_API}/api/webhook`);
    proxyUrl.searchParams.set('session_ip', ip);
    proxyUrl.searchParams.set('email', email);
    proxyUrl.searchParams.set('license_type', licenseType);

    const proxyRes = await fetch(proxyUrl.toString(), { method: 'DELETE' });
    const data = await proxyRes.json().catch(() => ({ error: 'Failed to cancel subscription' }));
    return NextResponse.json(data, { status: proxyRes.status });
  }

  try {
    const stripe = new Stripe(SECRET_KEY);
    const customers = await stripe.customers.list({ email, limit: 10 });

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 100,
      });

      const activeSubscriptions = subscriptions.data.filter((subscription) =>
        isActiveSubscriptionStatus(subscription.status),
      );
      const currentSubscription = pickCurrentSubscription(activeSubscriptions, ip, licenseType);

      if (!currentSubscription) {
        continue;
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: returnUrl,
      });

      if (currentSubscription.cancel_at_period_end) {
        await sendEmail(
          'han@privoce.com',
          email,
          'VoceSpace Subscription Cancellation Status',
          fmtContentCancel(
            'Your subscription is already scheduled for cancellation at the end of the current billing period.',
          ),
        );
        return NextResponse.json({
          success: true,
          alreadyCanceled: true,
          url: portalSession.url,
          subscriptionId: currentSubscription.id,
          cancelAtPeriodEnd: true,
          cancelAt: currentSubscription.cancel_at,
          currentPeriodEnd: getSubscriptionCurrentPeriodEnd(currentSubscription),
        });
      }

      await sendEmail(
        'han@privoce.com',
        email,
        'VoceSpace Subscription Cancellation Request',
        fmtContentCancel(
          'A subscription management page has been generated for your account. Please complete the cancellation in Stripe Billing Portal.',
        ),
      );

      return NextResponse.json({
        success: true,
        url: portalSession.url,
        subscriptionId: currentSubscription.id,
        cancelAtPeriodEnd: currentSubscription.cancel_at_period_end,
        cancelAt: currentSubscription.cancel_at,
        currentPeriodEnd: getSubscriptionCurrentPeriodEnd(currentSubscription),
      });
    }

    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to cancel Stripe subscription:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
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
