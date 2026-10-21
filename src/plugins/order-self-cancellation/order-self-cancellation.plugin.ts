import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { CancelMyOrderResultResolver, OrderSelfCancellationResolver } from './order-self-cancellation.resolver';
import { shopApiExtensions } from './shop-api-extensions';

/**
 * Adds a Shop API `cancelMyOrder` mutation so customers can cancel their own recently-placed,
 * not-yet-shipped order without contacting support. See
 * .ai/work/order-self-cancellation/architecture.md for the design and its corrections.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [OrderSelfCancellationResolver, CancelMyOrderResultResolver],
    },
    compatibility: '^3.0.0',
})
export class OrderSelfCancellationPlugin {}
