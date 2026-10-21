import { APP_INTERCEPTOR } from '@nestjs/core';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { GiftMessageInterceptor } from './gift-message.interceptor';

/**
 * Enforces the order gift-message rules that go beyond the `Order.giftMessage` custom field's
 * own `validate` hook (whitespace normalization, no staff edits after shipment). The field itself
 * is declared in vendure-config.ts. See .ai/work/order-gift-message/architecture.md.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: APP_INTERCEPTOR, useClass: GiftMessageInterceptor }],
    compatibility: '^3.0.0',
})
export class OrderGiftMessagePlugin {}
