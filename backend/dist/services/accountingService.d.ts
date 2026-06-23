export declare const accountingService: {
    getChartOfAccounts(userId: string): Promise<{
        id: string;
        userId: string;
        accountCode: string;
        accountName: string;
        accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
        description: string | null;
        balance: string | null;
        isActive: boolean | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createAccount(userId: string, data: any): Promise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean | null;
        description: string | null;
        accountCode: string;
        accountName: string;
        accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
        balance: string | null;
    }>;
    createJournalEntry(userId: string, data: any): Promise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        description: string;
        entryDate: Date;
        referenceType: string | null;
        referenceId: string | null;
        totalDebits: string;
        totalCredits: string;
        isPosted: boolean | null;
    }>;
    postJournalEntry(entryId: string, userId: string): Promise<{
        id: string;
        userId: string;
        entryDate: Date;
        description: string;
        referenceType: string | null;
        referenceId: string | null;
        totalDebits: string;
        totalCredits: string;
        isPosted: boolean | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getJournalEntries(userId: string): Promise<{
        id: string;
        userId: string;
        entryDate: Date;
        description: string;
        referenceType: string | null;
        referenceId: string | null;
        totalDebits: string;
        totalCredits: string;
        isPosted: boolean | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getAccountBalance(accountId: string, userId: string): Promise<string | null>;
    generateBalanceSheet(userId: string): Promise<{
        assets: {
            id: string;
            userId: string;
            accountCode: string;
            accountName: string;
            accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
            description: string | null;
            balance: string | null;
            isActive: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        liabilities: {
            id: string;
            userId: string;
            accountCode: string;
            accountName: string;
            accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
            description: string | null;
            balance: string | null;
            isActive: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        equity: {
            id: string;
            userId: string;
            accountCode: string;
            accountName: string;
            accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
            description: string | null;
            balance: string | null;
            isActive: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
    }>;
    generateIncomeStatement(userId: string): Promise<{
        revenues: number;
        expenses: number;
        netIncome: number;
        revenueAccounts: {
            id: string;
            userId: string;
            accountCode: string;
            accountName: string;
            accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
            description: string | null;
            balance: string | null;
            isActive: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        expenseAccounts: {
            id: string;
            userId: string;
            accountCode: string;
            accountName: string;
            accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
            description: string | null;
            balance: string | null;
            isActive: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
};
//# sourceMappingURL=accountingService.d.ts.map