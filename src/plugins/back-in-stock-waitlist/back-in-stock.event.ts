import { ProductVariant, RequestContext, VendureEvent } from '@vendure/core';

/** Published once per waiting person, after their waitlist row was claimed. Drives the email. */
export class BackInStockEvent extends VendureEvent {
    constructor(
        public readonly ctx: RequestContext,
        public readonly variant: ProductVariant,
        public readonly emailAddress: string,
    ) {
        super();
    }
}
