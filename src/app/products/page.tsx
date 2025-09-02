"use client";

import { Product } from "@/types";
import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Search, Filter, Plus, Edit, Trash2, Eye, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import Header from "@/components/Header";
// Import FilterSidebar normally to avoid build issues
import toast from "react-hot-toast";
import FilterSidebar from "@/components/FilterSidebar";

// A custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface FilterState {
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  organic: boolean;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get("category") || "",
    location: "",
    minPrice: "",
    maxPrice: "",
    organic: searchParams.get("organic") === "true",
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const activeFilters: Record<string, string> = {};
      if (filters.category) activeFilters.category = filters.category;
      if (filters.location) activeFilters.location = filters.location;
      if (filters.minPrice) activeFilters.minPrice = filters.minPrice;
      if (filters.maxPrice) activeFilters.maxPrice = filters.maxPrice;
      if (filters.organic) activeFilters.organic = "true";

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12",
        sortBy,
        sortOrder,
        search: debouncedSearchTerm, // Use the debounced search term
        ...activeFilters,
      });

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data.products);
        setTotalPages(data.totalPages);
      } else {
        toast.error(data.error || "Failed to fetch products");
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast.error("An error occurred while fetching products.");
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, sortBy, sortOrder, debouncedSearchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleAddToCart = (product: Product) => {
    if (!user) {
      toast.error("Please log in to add items to your cart.");
      router.push("/login");
      return;
    }
    addToCart(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleEditProduct = (productId: string) => {
    router.push(`/products/edit/${productId}`);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        toast.success("Product deleted successfully");
        fetchProducts();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete product");
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("An error occurred while deleting the product.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="mt-2 text-gray-600">
              Browse fresh local produce from farmers in your area
            </p>
          </div>
          {user?.role === "farmer" && (
            <button
              onClick={() => router.push("/products/add")}
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </button>
          )}
        </div>

        {/* Search, Filter, and Sort Controls */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </form>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
              <option value="rating-desc">Highest Rated</option>
            </select>
          </div>
          {showFilters && (
            <div className="mt-4">
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            </div>
          )}
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-md p-4 animate-pulse"
              >
                <div className="h-48 bg-gray-200 rounded-md mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No products found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col"
                >
                  <div className="relative h-48">
                    <Image
                      src={product.images?.[0] || "/placeholder.png"}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {product.organic && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        Organic
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded px-2 py-1 flex items-center">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-700 ml-1">
                        {product.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="text-sm text-gray-500 mb-2">
                      <span>
                        {product.farmLocation.city},{" "}
                        {product.farmLocation.state}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-gray-900">
                        ${product.price.toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {product.quantity} {product.unit} available
                      </span>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      {user?.role === "farmer" &&
                      product.farmer?._id === user?._id ? (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/products/${product._id}`)
                            }
                            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => handleEditProduct(product._id)}
                            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-md hover:bg-primary-50"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product._id)}
                            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/products/${product._id}`)
                            }
                            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={
                              !product.isAvailable || product.quantity === 0
                            }
                            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add to Cart
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === i + 1
                          ? "text-white bg-primary-600 border-primary-600"
                          : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
