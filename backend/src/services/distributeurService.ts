import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/drizzle";
import { distributors } from "../db/schema";
import bcrypt from "bcryptjs";

export const distributorsService = {
  async getAllDistributors() {
    return await db
      .select({
        id: distributors.id,
        name: distributors.name,
        phone: distributors.phone,
        email: distributors.email,
        address: distributors.address,
        isActive: distributors.isActive,
        businessType: distributors.businessType,
        city: distributors.city,
      })
      .from(distributors)
      .where(eq(distributors.isActive, true));
  },

  async getDistributorById(distributorId: string) {
    const result = await db
      .select()
      .from(distributors)
      .where(
        and(
          eq(distributors.id, distributorId),
          //eq(distributors.userId, userId)
        ),
      );

    if (result.length === 0) {
      throw new Error("Distributor not found");
    }

    return result[0];
  },

  async createDistributor(data: any) {
    if (!data.name) {
      throw new Error("Distributor name is required");
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newDistributor = {
      // id: uuidv4(),
      // userId,
      name: data.name,
      registrationNumber: data.registrationNumber || null,
      businessType: data.businessType || null,
      password: hashedPassword,
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

    const result = await db
      .insert(distributors)
      .values(newDistributor)
      .returning();

    return result[0];
  },

  async updateDistributor(distributorId: string, data: any) {
    await this.getDistributorById(distributorId); // Verify ownership

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.password) updateData.password = data.password;
    if (data.registrationNumber)
      updateData.registrationNumber = data.registrationNumber;
    if (data.businessType) updateData.businessType = data.businessType;
    if (data.address) updateData.address = data.address;
    if (data.city) updateData.city = data.city;
    if (data.postalCode) updateData.postalCode = data.postalCode;
    if (data.country) updateData.country = data.country;
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.website) updateData.website = data.website;
    if (data.contactPerson) updateData.contactPerson = data.contactPerson;
    if (data.paymentTerms) updateData.paymentTerms = data.paymentTerms;
    if (data.creditLimit) updateData.creditLimit = parseFloat(data.creditLimit);
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.notes) updateData.notes = data.notes;

    const result = await db
      .update(distributors)
      .set(updateData)
      .where(and(eq(distributors.id, distributorId)))
      .returning();

    return result[0];
  },

  async deleteDistributor(distributorId: string) {
    await this.getDistributorById(distributorId); // Verify ownership

    const result = await db
      .update(distributors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(distributors.id, distributorId)))
      .returning();

    return result[0];
  },

  async rateDistributor(distributorId: string, userId: string, rating: number) {
    if (rating < 0 || rating > 5) {
      throw new Error("Rating must be between 0 and 5");
    }

    await this.getDistributorById(distributorId);

    const result = await db
      .update(distributors)
      .set({ rating, updatedAt: new Date() })
      .where(and(eq(distributors.id, distributorId)))
      .returning();

    return result[0];
  },
};
