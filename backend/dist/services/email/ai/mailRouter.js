import { Router } from "express";
import { fetchSupplierEmails } from "./mail.service";
export const mailRouter = Router();
mailRouter.post("/fetch", async (req, res) => {
    try {
        await fetchSupplierEmails();
        res.json({
            success: true,
            message: "Emails récupérés avec succès.",
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Erreur pendant la récupération des emails.",
        });
    }
});
//# sourceMappingURL=mailRouter.js.map