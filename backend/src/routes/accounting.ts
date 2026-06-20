import { Router, Response } from "express";
import { accountingService } from "../services/accountingService.js";

import { AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const router: Router = Router();

router.get("/chart-of-accounts", async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await accountingService.getChartOfAccounts(req.userId!);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/accounts", async (req: AuthRequest, res: Response) => {
  try {
    const data = z
      .object({
        accountCode: z.string(),
        accountName: z.string(),
        accountType: z.enum([
          "asset",
          "liability",
          "equity",
          "revenue",
          "expense",
        ]),
        description: z.string().optional(),
      })
      .parse(req.body);

    const account = await accountingService.createAccount(req.userId!, data);
    res.status(201).json(account);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.get("/entries", async (req: AuthRequest, res: Response) => {
  try {
    const entries = await accountingService.getJournalEntries(req.userId!);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/entries", async (req: AuthRequest, res: Response) => {
  try {
    const data = z
      .object({
        description: z.string(),
        entryDate: z.string().optional(),
        referenceType: z.string().optional(),
        referenceId: z.string().optional(),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            accountId: z.string(),
            debit: z.string().or(z.number()).optional(),
            credit: z.string().or(z.number()).optional(),
            description: z.string().optional(),
            notes: z.string().optional(),
          }),
        ),
      })
      .parse(req.body);

    const entry = await accountingService.createJournalEntry(req.userId!, data);
    res.status(201).json(entry);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.post("/entries/:id/post", async (req: AuthRequest, res: Response) => {
  try {
    const entry = await accountingService.postJournalEntry(
      req.params.id,
      req.userId!,
    );
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get(
  "/reports/balance-sheet",
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await accountingService.generateBalanceSheet(req.userId!);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.get(
  "/reports/income-statement",
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await accountingService.generateIncomeStatement(
        req.userId!,
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
