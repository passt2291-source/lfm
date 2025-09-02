import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getUserFromRequest } from "@/lib/auth";

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

// ===================================================================
// GET /api/products - Get all products with filters, sorting, and pagination
// ===================================================================
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
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

    // Add search term to filter (searches name)
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category) {
      filter.category = category;
    }

    // Add location to filter (searches both city and state for flexibility)
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

    return NextResponse.json({
      products,
      currentPage: page,
      totalPages: totalPages,
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

// ===================================================================
// POST /api/products - Create a new product (farmers only)
// ===================================================================
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

    // Create a new product instance, assigning the authenticated farmer's ID
    const product = new Product({
      ...productData,
      // *** THIS IS THE FIX ***
      // Use user.sub, which is the standard JWT claim for the user's ID
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
