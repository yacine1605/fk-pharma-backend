export declare function checkUpcomingDeadlines(): Promise<{
    checkedAt: Date;
    notificationsCreated: number;
    details: string[];
}>;
export declare function checkExpiredDeadlines(): Promise<{
    expiredCount: number;
    expiredIds: string[];
}>;
//# sourceMappingURL=deadline-notifications.service.d.ts.map