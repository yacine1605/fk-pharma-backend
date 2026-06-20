import { eq, and } from "drizzle-orm";
import { db } from "../db/drizzle";
import { suppliers } from "../db/schema";

export const supplierService = {
  async getAllSuppliers() {
    return await db.select().from(suppliers);
    //.where(eq(suppliers.isActive, true));
  },

  async getSupplierById(supplierId: string) {
    const result = await db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.id, supplierId),
          //eq(suppliers.userId, userId)
        ),
      );

    if (result.length === 0) {
      throw new Error("Supplier not found");
    }

    return result[0];
  },

  async createSupplier(data: any) {
    if (!data.name) {
      throw new Error("Supplier name is required");
    }

    const newSupplier = {
      //id: uuidv4(),
      //userId,
      name: data.name,
      registrationNumber: data.registrationNumber || null,
      businessType: data.businessType?.toLowerCase() || null,
      address: data.address || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      contactPerson: data.contactPerson || null,
      paymentTerms: data.paymentTerms || null,
      creditLimit: data.creditLimit != null ? String(data.creditLimit) : null,
      rating: data.rating || 0,
      notes: data.notes || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(suppliers).values(newSupplier).returning();

    return result[0];
  },

  async updateSupplier(supplierId: string, data: any) {
    await this.getSupplierById(supplierId);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.registrationNumber !== undefined)
      updateData.registrationNumber = data.registrationNumber || null;
    if (data.businessType !== undefined)
      updateData.businessType = data.businessType || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.postalCode !== undefined)
      updateData.postalCode = data.postalCode || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (data.contactPerson !== undefined)
      updateData.contactPerson = data.contactPerson || null;
    if (data.paymentTerms !== undefined)
      updateData.paymentTerms = data.paymentTerms || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    // FIX: allow 0 and null
    if (data.creditLimit !== undefined) {
      updateData.creditLimit =
        data.creditLimit === null || data.creditLimit === ""
          ? null
          : parseFloat(data.creditLimit);
    }

    // FIX: allow rating 0
    if (data.rating !== undefined) {
      updateData.rating = data.rating === null ? null : Number(data.rating);
    }

    // FIX: allow toggling isActive
    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
    }

    const result = await db
      .update(suppliers)
      .set(updateData)
      .where(eq(suppliers.id, supplierId))
      .returning();

    return result[0];
  },

  async deleteSupplier(supplierId: string) {
    await this.getSupplierById(supplierId); // Verify ownership

    const result = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(suppliers.id, supplierId)))
      .returning();

    return result[0];
  },

  async rateSupplier(supplierId: string, userId: string, rating: number) {
    if (rating < 0 || rating > 5) {
      throw new Error("Rating must be between 0 and 5");
    }

    await this.getSupplierById(supplierId);

    const result = await db
      .update(suppliers)
      .set({ rating, updatedAt: new Date() })
      .where(and(eq(suppliers.id, supplierId)))
      .returning();

    return result[0];
  },
};
