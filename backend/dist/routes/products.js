import { Router } from "express";
import { productService } from "../services/productService.js";
import { z } from "zod";
const router = Router();
const productSchema = z.object({
    supplierId: z.string(),
    name: z.string().min(1),
    sku: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    unitPrice: z.string().or(z.number()),
    unitMeasure: z.string().optional(),
    quantity: z.number().optional(),
    specifications: z.any().optional(),
    notes: z.string().optional(),
});
router.get("/", async (req, res) => {
    try {
        const products = await productService.getAllProducts();
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get("/supplier/:supplierId", async (req, res) => {
    try {
        const products = await productService.getProductsBySupplier(req.params.supplierId);
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const product = await productService.getProductById(req.params.id);
        res.json(product);
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
router.post("/", async (req, res) => {
    try {
        const data = productSchema.parse(req.body);
        const product = await productService.createProduct(data);
        res.status(201).json(product);
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
router.put("/:id", async (req, res) => {
    try {
        const data = productSchema.partial().parse(req.body);
        const product = await productService.updateProduct(req.params.id, data);
        res.json(product);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
        }
        else if (error.message === "Product not found") {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
router.delete("/:id", async (req, res) => {
    try {
        await productService.deleteProduct(req.params.id, req.userId);
        res.json({ message: "Product deleted successfully" });
    }
    catch (error) {
        if (error.message === "Product not found") {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
export default router;
//# sourceMappingURL=products.js.map