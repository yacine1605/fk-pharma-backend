import { UserRole } from "../middleware/auth.js";
export declare const authService: {
    register(email: string, password: string, firstName: string, lastName: string, signature: string, role?: UserRole, requestingUserRole?: UserRole): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: UserRole;
            signature: string | null;
        };
        token: string;
    }>;
    login(email: string, password: string): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: UserRole;
            signature: string | null;
        };
        token: string;
    }>;
    getUserById(userId: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        company: string | null;
        phone: string | null;
        signature: string | null;
        role: UserRole;
    }>;
    /** Admin-only: list all users */
    listUsers(): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        createdAt: Date;
    }[]>;
    /** Admin-only: change any user's role */
    changeUserRole(targetUserId: string, newRole: UserRole): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
    }>;
};
//# sourceMappingURL=authService.d.ts.map