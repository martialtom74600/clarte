import Stripe from "stripe";
import { getCreditPack } from "@separation/marketplace";
import { requirePartnerSession } from "@/lib/partner-auth";
import { NextResponse } from "next/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: Request) {
  try {
    const session = await requirePartnerSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const { packId } = await request.json();
    const pack = getCreditPack(packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: session.partner.stripe_customer_id ?? undefined,
      customer_email: session.partner.stripe_customer_id ? undefined : session.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: pack.label,
              description: `${pack.credits} crédits leads Clarté Pro`,
            },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        partner_id: session.partner.id,
        pack_id: pack.id,
        credits: String(pack.credits),
        type: "partner_credits",
      },
      success_url: `${appUrl}/pro/credits?success=1`,
      cancel_url: `${appUrl}/pro/credits?cancelled=1`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Partner credits checkout error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
