import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  console.log("post aaya");
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") as string;
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata.orderId;

      if (!orderId) {
        console.error(
          "Webhook Error: Missing orderId in payment_intent.succeeded metadata."
        );
        return NextResponse.json(
          { error: "Webhook Error: Missing orderId" },
          { status: 400 }
        );
      }

      console.log(
        `[Webhook] Received successful payment for Order ID: ${orderId}`
      );
      await dbConnect();

      const order = await Order.findById(orderId).populate({
        path: "items.product",
        select: "name farmer quantity",
      });

      if (!order) {
        console.error(`[Webhook] Error: Order with ID ${orderId} not found.`);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.paymentStatus !== "paid") {
        console.log(`[Webhook] Updating order ${orderId} to 'paid'.`);
        order.paymentStatus = "paid";

        const farmerIdsToNotify = new Set<string>();

        for (const item of order.items) {
          const product = item.product;
          await Product.findByIdAndUpdate(product._id, {
            $inc: { quantity: -item.quantity },
          });

          const farmerId = product.farmer?.toString();
          if (farmerId) {
            farmerIdsToNotify.add(farmerId);
          }
        }

        await order.save();
        console.log(`[Webhook] Order ${orderId} successfully saved.`);

        for (const farmerId of farmerIdsToNotify) {
          const channel = `private-farmer-${farmerId}`;
          const eventName = "new-order";
          const payload = {
            message: `You have a new sale! Order #${orderId.slice(-6)}`,
            orderId: orderId,
          };
          console.log(
            `[Webhook] 🚀 Triggering '${eventName}' to channel: ${channel}`
          );
        }
      } else {
        console.log(
          `[Webhook] Order ${orderId} was already marked as paid. Skipping.`
        );
      }
    } else {
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Webhook handler error:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }
}
