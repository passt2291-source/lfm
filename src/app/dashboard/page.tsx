"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page if user is not authenticated after loading is complete
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Display a loading state while authentication status is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Return null or a placeholder if there's no user to prevent rendering the dashboard briefly before redirecting
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
          Dashboard
        </h1>
        <p className="text-gray-700 mb-8">Welcome back, {user.name}.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/orders"
            className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Your Orders
            </h2>
            <p className="text-gray-600">
              View your recent orders and their status.
            </p>
          </Link>

          <Link
            href="/products"
            className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Browse Products
            </h2>
            <p className="text-gray-600">
              Continue shopping from local farmers.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
