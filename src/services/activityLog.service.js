const prisma = require("../config/prisma");
const logger = require("../utils/logger");

/**
 * ActivityLogService — audit log for sensitive actions.
 *
 * `scopeId` is the user that owns the affected resource (used to filter the brand's
 * audit feed). For brand-targeted actions this is the brand id.
 *
 * Never throws — logging must not break the business operation.
 */
const ActivityLogService = {
    async log({ actorId, scopeId = null, action, entityType = null, entityId = null, metadata = null }) {
        try {
            return await prisma.activityLog.create({
                data: {
                    actorId,
                    scopeId,
                    action,
                    entityType,
                    entityId,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                },
            });
        } catch (e) {
            logger.warn(`ActivityLog failed: ${e.message}`);
            return null;
        }
    },

    async listForScope(scopeId, { page = 1, limit = 20, action } = {}) {
        const where = { scopeId };
        if (action) where.action = action;
        const skip = (page - 1) * limit;

        const [logs, total] = await prisma.$transaction([
            prisma.activityLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    actor: { select: { id: true, name: true, email: true, role: true, avatar: true } },
                },
            }),
            prisma.activityLog.count({ where }),
        ]);

        return {
            logs: logs.map((l) => ({ ...l, metadata: l.metadata ? safeParse(l.metadata) : null })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    async listForActor(actorId, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;
        const [logs, total] = await prisma.$transaction([
            prisma.activityLog.findMany({
                where: { actorId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.activityLog.count({ where: { actorId } }),
        ]);
        return {
            logs: logs.map((l) => ({ ...l, metadata: l.metadata ? safeParse(l.metadata) : null })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },
};

function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
}

module.exports = ActivityLogService;
