import Stripe from "stripe";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { NextResponse } from "next/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { email, simulation, result } = body as {
      email: string;
      simulation: SimulationInput;
      result: SimulationResult;
    };

    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: "Rapport premium Clarté",
                  description:
                    "PDF détaillé, scénarios illimités, lien partageable médiation",
                },
                unit_amount: 2900,
              },
              quantity: 1,
            },
          ],
      metadata: {
        email,
        tenantId: simulation.tenantId ?? "default",
        complexityScore: String(result.complexityScore),
      },
      success_url: `${appUrl}/simulation?premium=success`,
      cancel_url: `${appUrl}/simulation?premium=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
