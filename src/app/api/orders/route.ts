import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order, { IOrder } from "@/models/Order";
import Product from "@/models/Product";
import Notification from "@/models/Notification";
import "@/models/User"; // Ensures User model is registered before population
import { getUserFromRequest } from "@/lib/auth";
import { createPaymentIntent } from "@/lib/stripe";
import { FilterQuery } from "mongoose";
import Stripe from "stripe";

// --- GET /api/orders (Corrected with Filtering Logic) ---
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const { userId, role } = user;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    const view = searchParams.get("view");

    // Read and process the filters from the request URL
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const dateRange = searchParams.get("dateRange");

    const query: FilterQuery<IOrder> = {};

    // 1. Base query for sales vs purchases
    if (role === "farmer" && view === "sales") {
      const userProducts = await Product.find({ farmer: userId }).select("_id");
      const productIds = userProducts.map((p) => p._id);
      query["items.product"] = { $in: productIds };
    } else {
      query.customer = userId;
    }

    // 2. Dynamically add status filters to the query if they exist
    if (status) {
      query.status = status;
    }
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // 3. Handle date range filtering
    if (dateRange) {
      const now = new Date();
      let startDate: Date | null = null;

      switch (dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          const firstDayOfWeek = now.getDate() - now.getDay();
          startDate = new Date(now.setDate(firstDayOfWeek));
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    const orders = await Order.find(query)
      .populate("customer", "name email")
      .populate("items.product", "name price images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for better performance on read-only queries

    const total = await Order.countDocuments(query);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { items, shippingAddress, paymentMethod, notes } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Order must contain at least one item" },
        { status: 400 }
      );
    }
    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Shipping address is required" },
        { status: 400 }
      );
    }

    const orderItems = [];
    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.product} not found` },
          { status: 404 }
        );
      }
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }
      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const order = new Order({
      customer: user.userId,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes,
    });
    const savedOrder = await order.save();

    const productIds = orderItems.map((item) => item.product);
    const productsInOrder = await Product.find({ _id: { $in: productIds } });
    const farmerIds = new Set(productsInOrder.map((p) => p.farmer.toString()));

    let paymentIntent: Stripe.PaymentIntent | null = null;
    if (paymentMethod === "stripe") {
      paymentIntent = await createPaymentIntent(
        totalAmount,
        savedOrder._id.toString()
      );
      order.stripePaymentIntentId = paymentIntent.id;
      await order.save();
    }

    await savedOrder.populate("customer", "name email");
    await savedOrder.populate("items.product", "name price images");

    for (const farmerId of farmerIds) {
      await Notification.create({
        user: farmerId,
        message: `You have a new order (#${savedOrder._id
          .toString()
          .slice(-6)}) containing your products.`,
        link: `/${savedOrder._id}`,
      });
    }

    await Notification.create({
      user: savedOrder.customer,
      message: `Your order #${savedOrder._id
        .toString()
        .slice(-6)} has been placed successfully!`,
      link: `/${savedOrder._id}`,
    });

    return NextResponse.json({
      order: savedOrder,
      paymentIntent: paymentIntent
        ? { id: paymentIntent.id, clientSecret: paymentIntent.client_secret }
        : null,
      message: "Order created successfully",
    });
  } catch (error: unknown) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
