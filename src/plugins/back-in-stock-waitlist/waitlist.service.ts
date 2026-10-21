import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    EventBus,
    ID,
    idsAreEqual,
    Logger,
    ProductVariantService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';

import { BackInStockEvent } from './back-in-stock.event';
import { WaitlistEntry } from './waitlist-entry.entity';
import { isValidEmail, normaliseEmail } from './waitlist-rules';

const loggerCtx = 'BackInStockWaitlist';

type WaitlistErrorReason = 'VARIANT_IN_STOCK' | 'VARIANT_NOT_FOUND' | 'INVALID_EMAIL' | 'EMAIL_REQUIRED';

export type JoinOutcome =
    | { __typename: 'WaitlistJoined'; alreadyOnList: boolean }
    | { __typename: 'WaitlistError'; errorCode: 'WAITLIST_ERROR'; message: 'WAITLIST_ERROR'; reason: WaitlistErrorReason };

function waitlistError(reason: WaitlistErrorReason): JoinOutcome {
    return { __typename: 'WaitlistError', errorCode: 'WAITLIST_ERROR', message: 'WAITLIST_ERROR', reason };
}

@Injectable()
export class WaitlistService {
    constructor(
        private connection: TransactionalConnection,
        private productVariantService: ProductVariantService,
        private customerService: CustomerService,
        private eventBus: EventBus,
    ) {}

    /**
     * Joins the waitlist for an out-of-stock variant. Every guard runs before the single write, so
     * returning a typed error (rather than throwing) never leaves anything to roll back.
     */
    async join(ctx: RequestContext, productVariantId: ID, emailAddress?: string | null): Promise<JoinOutcome> {
        let raw = emailAddress ?? undefined;
        if (!raw && ctx.activeUserId) {
            raw = (await this.customerService.findOneByUserId(ctx, ctx.activeUserId))?.emailAddress;
        }
        if (!raw) return waitlistError('EMAIL_REQUIRED');
        const email = normaliseEmail(raw);
        if (!isValidEmail(email)) return waitlistError('INVALID_EMAIL');

        // findOne is channel-aware and excludes soft-deleted variants. Missing, deleted and disabled
        // all answer the same way so nothing about the catalogue leaks.
        const variant = await this.productVariantService.findOne(ctx, productVariantId);
        if (!variant || !variant.enabled) return waitlistError('VARIANT_NOT_FOUND');

        // The same rule addItemToOrder uses, so "out of stock" means one thing in this system.
        if ((await this.productVariantService.getSaleableStockLevel(ctx, variant)) > 0) {
            return waitlistError('VARIANT_IN_STOCK');
        }

        const repo = this.connection.getRepository(ctx, WaitlistEntry);
        const where = { productVariantId: variant.id, emailAddress: email };
        if (await repo.findOne({ where })) return { __typename: 'WaitlistJoined', alreadyOnList: true };
        try {
            await repo.save(new WaitlistEntry(where));
        } catch (e) {
            // Lost a race with an identical concurrent join: the unique index did its job.
            if (await repo.findOne({ where })) return { __typename: 'WaitlistJoined', alreadyOnList: true };
            throw e;
        }
        return { __typename: 'WaitlistJoined', alreadyOnList: false };
    }

    /** Never reveals whether the address was on the list, and never sends anything. */
    async leave(ctx: RequestContext, productVariantId: ID, emailAddress: string): Promise<void> {
        await this.connection
            .getRepository(ctx, WaitlistEntry)
            .delete({ productVariantId, emailAddress: normaliseEmail(emailAddress) });
    }

    /** One GROUP BY for all ids; variants nobody waits for come back as 0. */
    async counts(ctx: RequestContext, productVariantIds: ID[]): Promise<Array<{ productVariantId: ID; waiting: number }>> {
        if (!productVariantIds.length) return [];
        const rows: Array<{ productVariantId: ID; waiting: string | number }> = await this.connection
            .getRepository(ctx, WaitlistEntry)
            .createQueryBuilder('w')
            .select('w.productVariantId', 'productVariantId')
            .addSelect('COUNT(*)', 'waiting')
            .where('w.productVariantId IN (:...ids)', { ids: productVariantIds })
            .groupBy('w.productVariantId')
            .getRawMany();
        return productVariantIds.map(id => ({
            productVariantId: id,
            waiting: Number(rows.find(r => idsAreEqual(r.productVariantId, id))?.waiting ?? 0),
        }));
    }

    /**
     * Notifies and removes everyone waiting for those variants that are saleable right now.
     * Cheap when nobody waits: the first query returns nothing and we stop.
     */
    async notifyIfSaleable(ctx: RequestContext, variantIds: ID[]): Promise<void> {
        if (!variantIds.length) return;
        const repo = this.connection.getRepository(ctx, WaitlistEntry);
        const entries = await repo.find({ where: { productVariantId: In(variantIds) } });
        if (!entries.length) return;

        const waitingVariantIds = [...new Set(entries.map(e => String(e.productVariantId)))];
        for (const variantId of waitingVariantIds) {
            const variant = await this.productVariantService.findOne(ctx, variantId);
            if (!variant || !variant.enabled) continue;
            if ((await this.productVariantService.getSaleableStockLevel(ctx, variant)) <= 0) continue;

            for (const entry of entries.filter(e => String(e.productVariantId) === variantId)) {
                // Claim by deleting: one atomic statement, so two concurrent watchers cannot both win.
                const claim = await repo.delete(entry.id);
                if (claim.affected === 1) {
                    await this.eventBus.publish(new BackInStockEvent(ctx, variant, entry.emailAddress));
                }
            }
            Logger.verbose(`Variant ${variantId} is saleable again; waiting list notified`, loggerCtx);
        }
    }

    /** Variant deleted: drop its entries without telling anyone. */
    async clearForVariants(ctx: RequestContext, variantIds: ID[]): Promise<void> {
        if (!variantIds.length) return;
        await this.connection.getRepository(ctx, WaitlistEntry).delete({ productVariantId: In(variantIds) });
    }
}
