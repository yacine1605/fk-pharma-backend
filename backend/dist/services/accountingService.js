import { eq, and } from "drizzle-orm";
import { db } from "../db/drizzle";
import { chartOfAccounts, journalEntries, journalEntryLines, } from "../db/schema";
export const accountingService = {
    async getChartOfAccounts(userId) {
        return await db
            .select()
            .from(chartOfAccounts)
            .where(eq(chartOfAccounts.userId, userId));
    },
    async createAccount(userId, data) {
        if (!data.accountCode || !data.accountName || !data.accountType) {
            throw new Error("Account code, name, and type are required");
        }
        const newAccount = {
            userId,
            accountCode: data.accountCode,
            accountName: data.accountName,
            accountType: data.accountType,
            description: data.description || null,
            balance: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db
            .insert(chartOfAccounts)
            .values(newAccount)
            .returning();
        return result[0];
    },
    async createJournalEntry(userId, data) {
        if (!data.description || !data.lines || data.lines.length === 0) {
            throw new Error("Description and journal entry lines are required");
        }
        // Calculate totals
        const totalDebits = data.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const totalCredits = data.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            throw new Error("Debits and credits must balance");
        }
        const entry = {
            userId,
            entryDate: data.entryDate ? new Date(data.entryDate) : new Date(),
            description: data.description,
            referenceType: data.referenceType || null,
            referenceId: data.referenceId || null,
            totalDebits: String(totalDebits),
            totalCredits: String(totalCredits),
            isPosted: false,
            notes: data.notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const resultEntry = await db
            .insert(journalEntries)
            .values(entry)
            .returning();
        const entryId = resultEntry[0].id;
        // Insert lines
        for (const line of data.lines) {
            await db.insert(journalEntryLines).values({
                entryId,
                accountId: line.accountId,
                debit: String(line.debit || 0),
                credit: String(line.credit || 0),
                description: line.description || null,
                notes: line.notes || null,
            });
        }
        return resultEntry[0];
    },
    async postJournalEntry(entryId, userId) {
        // Verify ownership
        const entry = await db
            .select()
            .from(journalEntries)
            .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)));
        if (entry.length === 0) {
            throw new Error("Journal entry not found");
        }
        // Update entry status
        const result = await db
            .update(journalEntries)
            .set({ isPosted: true, updatedAt: new Date() })
            .where(eq(journalEntries.id, entryId))
            .returning();
        return result[0];
    },
    async getJournalEntries(userId) {
        return await db
            .select()
            .from(journalEntries)
            .where(eq(journalEntries.userId, userId));
    },
    async getAccountBalance(accountId, userId) {
        const account = await db
            .select()
            .from(chartOfAccounts)
            .where(and(eq(chartOfAccounts.id, accountId), eq(chartOfAccounts.userId, userId)));
        if (account.length === 0) {
            throw new Error("Account not found");
        }
        return account[0].balance;
    },
    async generateBalanceSheet(userId) {
        const accounts = await db
            .select()
            .from(chartOfAccounts)
            .where(eq(chartOfAccounts.userId, userId));
        const balanceSheet = {
            assets: accounts.filter((a) => a.accountType === "asset"),
            liabilities: accounts.filter((a) => a.accountType === "liability"),
            equity: accounts.filter((a) => a.accountType === "equity"),
            totalAssets: accounts
                .filter((a) => a.accountType === "asset")
                .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0),
            totalLiabilities: accounts
                .filter((a) => a.accountType === "liability")
                .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0),
            totalEquity: accounts
                .filter((a) => a.accountType === "equity")
                .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0),
        };
        return balanceSheet;
    },
    async generateIncomeStatement(userId) {
        const accounts = await db
            .select()
            .from(chartOfAccounts)
            .where(eq(chartOfAccounts.userId, userId));
        const revenues = accounts
            .filter((a) => a.accountType === "revenue")
            .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
        const expenses = accounts
            .filter((a) => a.accountType === "expense")
            .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
        return {
            revenues,
            expenses,
            netIncome: revenues - expenses,
            revenueAccounts: accounts.filter((a) => a.accountType === "revenue"),
            expenseAccounts: accounts.filter((a) => a.accountType === "expense"),
        };
    },
};
//# sourceMappingURL=accountingService.js.map