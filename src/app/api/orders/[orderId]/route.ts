import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import Stripe from "stripe";
import Order from "@/models/Order";
import Notification from "@/models/Notification";

interface PopulatedOrderItem {
  product: {
    farmer: {
      toString: () => string;
    };
  };
}
const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);

// GET /api/orders/[orderId]
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = params;
    const order = await Order.findById(orderId)
      .populate("customer", "name email")
      .populate({
        path: "items.product",
        select: "name price images farmer",
      });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isCustomer = order.customer._id.toString() === user.userId;
    const isFarmerInvolved = order.items.some(
      (item: PopulatedOrderItem) =>
        item.product?.farmer?.toString() === user.userId
    );
    if (!isCustomer && !isFarmerInvolved) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let paymentIntentData = null;
    if (order.stripePaymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId
      );
      paymentIntentData = { clientSecret: paymentIntent.client_secret };
    }

    return NextResponse.json({
      success: true,
      order,
      paymentIntent: paymentIntentData,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[orderId]
export async function PUT(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
   
    await dbConnect();
    const user = getUserFromRequest(req);

    const body = await req.json();

    // Customer updating payment status (THIS SHOULD NOT HAPPEN, but as a safeguard)
    // The webhook is the source of truth for payment updates.
    if (body.paymentStatus && (!user || user.role !== "admin")) {
      // Only an admin could manually override.
      return NextResponse.json(
        { error: "Forbidden: Only webhooks can update payment status." },
        { status: 403 }
      );
    }

    // Farmer updating shipping status
    if (body.status) {
      if (!user || user.role !== "farmer") {
        return NextResponse.json(
          { error: "Unauthorized: Only farmers can update shipping status." },
          { status: 401 }
        );
      }

      const { orderId } = params;
      const { status } = body;

      const order = await Order.findById(orderId)
        .populate({ path: "items.product", select: "name farmer" })
        .populate("customer", "_id name");

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const isFarmerInvolved = order.items.some(
        (item: PopulatedOrderItem) =>
          item.product?.farmer?.toString() === user.userId
      );

      if (!isFarmerInvolved) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You are not the farmer for any product in this order.",
          },
          { status: 403 }
        );
      }

      order.status = status;
      await order.save();

      const updatedOrder = await Order.findById(orderId)
        .populate("customer", "name email")
        .populate("items.product", "name price images");

      await Notification.create({
        user: order.customer._id,
        message: `Update: Your order #${order._id
          .toString()
          .slice(-6)} has been marked as '${status}'.`,
        link: `/${order._id}`,
      });

  
      return NextResponse.json({ success: true, order: updatedOrder });
    }

    return NextResponse.json(
      { error: "No valid update parameters provided." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
