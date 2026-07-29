import Stripe from "stripe";
import { getCreditPack } from "@separation/marketplace";
import { grantPartnerCredits } from "@/lib/supabase";
import { NextResponse } from "next/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_PARTNER_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.type === "partner_credits") {
        const partnerId = session.metadata.partner_id;
        const packId = session.metadata.pack_id;
        const pack = packId ? getCreditPack(packId) : null;
        const credits = pack?.credits ?? Number(session.metadata.credits ?? 0);

        if (partnerId && credits > 0) {
          await grantPartnerCredits(
            partnerId,
            credits,
            `pack_${packId ?? "custom"}`,
            session.id
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Partner webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 400 });
  }
}
