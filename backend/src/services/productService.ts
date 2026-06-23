import { eq, and } from "drizzle-orm";
import { db } from "../db/drizzle";
import { products, suppliers } from "../db/schema";

export const productService = {
  async getAllProducts() {
    return await db
      .select({
        // Product fields
        id: products.id,
        name: products.name,
        category: products.category,
        description: products.description,
        quantity: products.quantity,
        unitPrice: products.unitPrice,
        unitMeasure: products.unitMeasure,
        sku: products.sku,
        notes: products.notes,
        specifications: products.specifications,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        // Supplier field
        supplierName: suppliers.name,
      })
      .from(products)
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id));
  },

  async getProductById(productId: string) {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (result.length === 0) {
      throw new Error("Product not found");
    }

    return result[0];
  },

  async getProductsBySupplier(supplierId: string) {
    return await db
      .select()
      .from(products)
      .where(
        and(
          // eq(products.userId, userId),
          eq(products.supplierId, supplierId),
          eq(products.isActive, true),
        ),
      );
  },

  async createProduct(data: any) {
    if (!data.name || !data.supplierId || !data.unitPrice) {
      throw new Error("Product name, supplier, and price are required");
    }

    const newProduct = {
      supplierId: data.supplierId,
      name: data.name,
      sku: data.sku || `SKU-${Date.now()}`,
      category: data.category || null,
      description: data.description || null,
      unitPrice: String(data.unitPrice),
      unitMeasure: data.unitMeasure || "UNIT",
      quantity: data.quantity || 0,
      specifications: data.specifications
        ? JSON.stringify(data.specifications)
        : null,
      notes: data.notes || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(products).values(newProduct).returning();

    return result[0];
  },

  async updateProduct(productId: string, data: any) {
    await this.getProductById(productId);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.sku) updateData.sku = data.sku;
    if (data.category) updateData.category = data.category;
    if (data.description) updateData.description = data.description;
    if (data.unitPrice) updateData.unitPrice = String(data.unitPrice);
    if (data.unitMeasure) updateData.unitMeasure = data.unitMeasure;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.specifications)
      updateData.specifications = JSON.stringify(data.specifications);
    if (data.notes) updateData.notes = data.notes;

    const result = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, productId)))
      .returning();

    return result[0];
  },

  async deleteProduct(productId: string, userId: string) {
    await this.getProductById(productId);

    const result = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(products.id, productId)))
      .returning();

    return result[0];
  },
};
