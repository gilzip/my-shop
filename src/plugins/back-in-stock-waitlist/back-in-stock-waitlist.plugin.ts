import { OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    Logger,
    PluginCommonModule,
    ProductVariantEvent,
    StockMovementEvent,
    VendurePlugin,
} from '@vendure/core';
import { EmailSendEvent } from '@vendure/email-plugin';

import { adminApiExtensions } from './admin-api-extensions';
import { WaitlistAdminResolver } from './admin.resolver';
import { BACK_IN_STOCK_METADATA_KEY } from './back-in-stock-email-handler';
import { shopApiExtensions } from './shop-api-extensions';
import { JoinWaitlistResultResolver, WaitlistShopResolver } from './shop.resolver';
import { WaitlistEntry } from './waitlist-entry.entity';
import { restockCandidateVariantIds } from './waitlist-rules';
import { WaitlistService } from './waitlist.service';

const loggerCtx = 'BackInStockWaitlist';

/**
 * Back-in-stock waitlist. See .ai/work/back-in-stock-waitlist/architecture.md.
 *
 * The subscriptions run after the publishing transaction commits (EventBus.ofType), so they see
 * the final stock level, and they run outside the request that changed the stock.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [WaitlistEntry],
    providers: [WaitlistService],
    shopApiExtensions: { schema: shopApiExtensions, resolvers: [WaitlistShopResolver, JoinWaitlistResultResolver] },
    adminApiExtensions: { schema: adminApiExtensions, resolvers: [WaitlistAdminResolver] },
    compatibility: '^3.0.0',
})
export class BackInStockWaitlistPlugin implements OnApplicationBootstrap {
    constructor(private eventBus: EventBus, private waitlistService: WaitlistService) {}

    onApplicationBootstrap() {
        // A throw inside a subscriber would end the subscription, so every handler catches and logs.
        this.eventBus.ofType(StockMovementEvent).subscribe(event =>
            this.safely('stock movement', () =>
                this.waitlistService.notifyIfSaleable(event.ctx, restockCandidateVariantIds(event.stockMovements)),
            ),
        );

        this.eventBus.ofType(ProductVariantEvent).subscribe(event =>
            this.safely('variant ' + event.type, async () => {
                const ids = event.entity.map(v => v.id);
                if (event.type === 'updated') await this.waitlistService.notifyIfSaleable(event.ctx, ids);
                if (event.type === 'deleted') await this.waitlistService.clearForVariants(event.ctx, ids);
            }),
        );

        // EmailPlugin publishes this once per attempt and retries 5 times, so a failure here is not
        // necessarily final. The row was already removed on claim (see architecture.md, "Risks").
        this.eventBus.ofType(EmailSendEvent).subscribe(event => {
            if (!event.success && event.metadata?.[BACK_IN_STOCK_METADATA_KEY]) {
                Logger.error(
                    `Back-in-stock email failed for variant ${event.metadata.productVariantId}: ${event.error?.message}`,
                    loggerCtx,
                );
            }
        });
    }

    private async safely(what: string, fn: () => Promise<void>) {
        try {
            await fn();
        } catch (e) {
            Logger.error(`Waitlist handling of ${what} failed: ${(e as Error).message}`, loggerCtx);
        }
    }
}
