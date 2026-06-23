import { Router } from "express";
import { distributorsService } from "../services/distributeurService";
import { z } from "zod";
const router = Router();
const distributeurSchema = z.object({
    name: z.string().min(1, "Distributeur name is required"),
    registrationNumber: z.string().optional(),
    businessType: z.string().optional(),
    address: z.string().optional(),
    password: z.string().min(6),
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
// Get all distributeurs for user
router.get("/", async (req, res) => {
    try {
        const result = await distributorsService.getAllDistributors();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get single distributeur
router.get("/:id", async (req, res) => {
    try {
        const distributeur = await distributorsService.getDistributorById(req.params.id);
        res.json(distributeur);
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
// Create supplier
router.post("/", async (req, res) => {
    try {
        const data = distributeurSchema.parse(req.body);
        const distributeur = await distributorsService.createDistributor(data);
        res.status(201).json(distributeur);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
// Update supplier
router.put("/:id", async (req, res) => {
    try {
        const data = distributeurSchema.partial().parse(req.body);
        const distributeur = await distributorsService.updateDistributor(req.params.id, 
        //req.userId!,
        data);
        res.json(distributeur);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
        }
        else if (error.message === "Distributeur not found") {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
// Delete supplier
router.delete("/:id", async (req, res) => {
    try {
        await distributorsService.deleteDistributor(req.params.id);
        res.json({ message: "Distributeur deleted successfully" });
    }
    catch (error) {
        if (error.message === "Distributeur not found") {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
// Rate supplier
router.post("/:id/rate", async (req, res) => {
    try {
        const { rating } = z
            .object({ rating: z.number().min(0).max(5) })
            .parse(req.body);
        const distributeur = await distributorsService.rateDistributor(req.params.id, req.userId, rating);
        res.json(distributeur);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
export default router;
//# sourceMappingURL=distributeur.js.map