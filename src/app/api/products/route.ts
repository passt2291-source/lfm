import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getUserFromRequest } from "@/lib/auth";
import { Product as ProductType } from "@/types";

// Simple in-memory cache for products
const productsCache = new Map<string, { data: { products: ProductType[]; currentPage: number; totalPages: number }; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const generateCacheKey = (params: URLSearchParams) => {
  const relevantParams = ['search', 'category', 'location', 'minPrice', 'maxPrice', 'organic', 'page', 'limit', 'sortBy', 'sortOrder'];
  const cacheKey = relevantParams.map(param => `${param}:${params.get(param) || ''}`).join('|');
  return cacheKey;
};

// Define a flexible interface for the MongoDB query filter
interface ProductFilter {
  isAvailable: boolean;
  name?: { $regex: string; $options: string };
  category?: string;
  "farmLocation.city"?: { $regex: string; $options: string };
  "farmLocation.state"?: { $regex: string; $options: string };
  price?: { $gte?: number; $lte?: number };
  organic?: boolean;
  $or?: Array<Record<string, { $regex: string; $options: string }>>;
}

// Define an interface for the sorting object
interface SortOptions {
  [key: string]: "asc" | "desc";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cacheKey = generateCacheKey(searchParams);

    // Check cache first
    const cached = productsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log("Serving products from cache");
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache-Status': 'HIT'
        }
      });
    }

    await dbConnect();

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const location = searchParams.get("location");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const organic = searchParams.get("organic");

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build the filter object for the database query
    const filter: ProductFilter = {
      isAvailable: true,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category) {
      filter.category = category;
    }

    if (location) {
      filter.$or = [
        { "farmLocation.city": { $regex: location, $options: "i" } },
        { "farmLocation.state": { $regex: location, $options: "i" } },
      ];
    }

    // Add price range to filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (organic === "true") {
      filter.organic = true;
    }

    // Build the sort object
    const sortOptions: SortOptions = { [sortBy]: sortOrder as "asc" | "desc" };

    // Get the total count of documents matching the filter for pagination
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get the products with pagination, filtering, and sorting
    const products = await Product.find(filter)
      .populate("farmer", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const responseData = {
      products,
      currentPage: page,
      totalPages: totalPages,
    };

    // Cache the response
    productsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (productsCache.size > 100) {
      const cutoff = Date.now() - CACHE_DURATION;
      for (const [key, value] of productsCache.entries()) {
        if (value.timestamp < cutoff) {
          productsCache.delete(key);
        }
      }
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache-Status': 'MISS'
      }
    });
  } catch (error: unknown) {
    console.error("GET /api/products error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}


export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Authenticate the user from the request token
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    // Authorize: ensure the user is a farmer
    if (user.role !== "farmer") {
      return NextResponse.json(
        { error: "Forbidden. Only farmers can create products." },
        { status: 403 }
      );
    }

    const productData = await req.json();

    // Basic server-side validation
    const requiredFields = [
      "name",
      "description",
      "price",
      "category",
      "quantity",
      "unit",
      "farmLocation",
      "harvestDate",
      "images",
    ];

    for (const field of requiredFields) {
      if (
        !productData[field] ||
        (Array.isArray(productData[field]) && productData[field].length === 0)
      ) {
        return NextResponse.json(
          { error: `Field '${field}' is required and cannot be empty.` },
          { status: 400 }
        );
      }
    }

    const product = new Product({
      ...productData,
      farmer: user,
    });

    await product.save();

    // Populate farmer info before sending the response
    await product.populate("farmer", "name email");

    return NextResponse.json(
      {
        product,
        message: "Product created successfully.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/products error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
