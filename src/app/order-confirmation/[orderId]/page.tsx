"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import Header from "@/components/Header";
import { CheckCircle } from "lucide-react";

export default function OrderConfirmationPage() {
  const { clearCart, getTotalItems } = useCart();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // Only clear cart if it still has items (in case it wasn't cleared during checkout)
    if (getTotalItems() > 0) {
      try {
        clearCart();
        console.log("Cart cleared on order confirmation page");
      } catch (err) {
        console.log("Failed to clear the cart", err);
      }
    } else {
      console.log("Cart already cleared, skipping clear operation");
    }
  }, [clearCart, getTotalItems]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-3xl font-extrabold text-gray-900">
          Thank you for your order!
        </h1>
        <p className="mt-2 text-base text-gray-500">
          Your payment was successful and your order is now being processed.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Order ID: #{String(params.orderId).slice(-8)}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => router.push("/orders")}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            View My Orders
          </button>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
