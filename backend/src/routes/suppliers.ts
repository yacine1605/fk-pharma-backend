import { Router, Response } from "express";
import { supplierService } from "../services/supplierService.js";
import { AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const router: Router = Router();

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  registrationNumber: z.string().optional(),
  businessType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  contactPerson: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.string().or(z.number()).optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

// Get all suppliers for user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result = await supplierService.getAllSuppliers();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single supplier
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    res.json(supplier);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create supplier
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await supplierService.createSupplier(data);
    res.status(201).json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// Update supplier
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = supplierSchema.partial().parse(req.body);
    const supplier = await supplierService.updateSupplier(
      req.params.id,
      //req.userId!,
      data,
    );
    res.json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else if (error.message === "Supplier not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// Delete supplier
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await supplierService.deleteSupplier(req.params.id);
    res.json({ message: "Supplier deleted successfully" });
  } catch (error: any) {
    if (error.message === "Supplier not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Rate supplier
router.post("/:id/rate", async (req: AuthRequest, res: Response) => {
  try {
    const { rating } = z
      .object({ rating: z.number().min(0).max(5) })
      .parse(req.body);
    const supplier = await supplierService.rateSupplier(
      req.params.id,
      req.userId!,
      rating,
    );
    res.json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = supplierSchema.partial().parse(req.body);
    const supplier = await supplierService.updateSupplier(req.params.id, data);
    res.json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else if (error.message === "Supplier not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});
export default router;
