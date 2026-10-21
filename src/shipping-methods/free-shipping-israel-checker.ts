import { LanguageCode, Order, ShippingEligibilityChecker } from '@vendure/core';

export const freeShippingIsraelChecker = new ShippingEligibilityChecker({
    code: 'free-shipping-israel-checker',
    description: [{
        languageCode: LanguageCode.en,
        value: 'Eligible only for orders shipping to Israel with a subtotal at or above the configured minimum',
    }],
    args: {
        // Minor units of the channel's currency. The default channel is USD, so
        // 20_000 = $200. Vendure stores all money values in minor units, matching
        // this project's other shipping rates.
        orderMinimum: {
            type: 'int',
            defaultValue: 20_000,
            ui: { component: 'currency-form-input' },
            label: [{ languageCode: LanguageCode.en, value: 'Minimum order value (minor units)' }],
        },
    },
    check: (ctx, order: Order, args) => {
        return order.shippingAddress?.countryCode === 'IL'
            && order.subTotalWithTax >= args.orderMinimum;
    },
});
