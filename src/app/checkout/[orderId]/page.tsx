"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import toast from "react-hot-toast";

export const dynamic = "force-dynamic";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface Order {
  _id: string;
  totalAmount: number;
  items: Array<{
    product: {
      name: string;
      price: number;
      images: string[];
    };
    quantity: number;
  }>;
  status: string;
  paymentStatus: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${params.orderId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        if (data.paymentIntent && data.paymentIntent.clientSecret) {
          setClientSecret(data.paymentIntent.clientSecret);
        }
      } else {
        toast.error("Failed to load order details.");
        router.push("/cart");
      }
    } catch {
      toast.error("An error occurred while fetching the order.");
      router.push("/cart");
    } finally {
      setLoading(false);
    }
  }, [params.orderId, router]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchOrder();
  }, [user, fetchOrder, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Order not found</h3>
          <p className="mt-1 text-sm text-gray-500">The order you&apos;re looking for doesn&apos;t exist.</p>
          <div className="mt-6">
            <button
              onClick={() => router.push("/cart")}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Back to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Checkout</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="relative flex-shrink-0 w-16 h-16">
                      {item.product.images && item.product.images.length > 0 ? (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product.name}
                          fill
                          className="object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Image</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{item.product.name}</h3>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex justify-between text-base font-medium text-gray-900">
                  <p>Total</p>
                  <p>${order.totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Payment</h2>
              {order.paymentStatus === "paid" ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Payment Successful!</h3>
                  <p className="mt-1 text-sm text-gray-500">Your order has been confirmed.</p>
                  <div className="mt-6">
                    <button
                      onClick={() => router.push("/orders")}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                      View Orders
                    </button>
                  </div>
                </div>
              ) : clientSecret && stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutPaymentForm orderId={String(params.orderId)} />
                </Elements>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Payment Processing</h3>
                  <p className="mt-1 text-sm text-gray-500">Setting up your payment...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// CORRECTED PAYMENT FORM COMPONENT
function CheckoutPaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation/${orderId}`,
      },
    });

    if (submitError) {
      setError(submitError.message || "An unexpected error occurred.");
      setSubmitting(false);
    } else {
      // Clear cart immediately after successful payment confirmation
      try {
        clearCart();
        console.log("Cart cleared after successful payment");
      } catch (err) {
        console.error("Failed to clear cart after payment:", err);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full mt-4 bg-primary-600 text-white rounded-md py-3 disabled:opacity-50"
      >
        {submitting ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}
