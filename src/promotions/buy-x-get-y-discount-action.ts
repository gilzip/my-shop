import { LanguageCode, PromotionItemAction } from '@vendure/core';
// Deep import: buyXGetYFreeCondition is not re-exported from @vendure/core's public
// entry point, only defined here. No package.json "exports" restriction blocks this,
// but it's unofficial surface - if a future @vendure/core upgrade moves/removes this
// file, this import breaks and the condition's check() logic would need reimplementing
// under the same 'buy_x_get_y_free' state key instead.
import { buyXGetYFreeCondition } from '@vendure/core/dist/config/promotion/conditions/buy-x-get-y-free-condition';

export const buyXGetYDiscountAction = new PromotionItemAction({
    code: 'buy_x_get_y_discount',
    description: [{
        languageCode: LanguageCode.en,
        value: 'Discount the qualifying units of Y by the configured percentage',
    }],
    args: {
        discountPercentage: {
            type: 'float',
            ui: { component: 'number-form-input', suffix: '%', min: 0, max: 100 },
            label: [{ languageCode: LanguageCode.en, value: 'Discount percentage on qualifying Y units' }],
        },
    },
    conditions: [buyXGetYFreeCondition],
    execute(ctx, orderLine, args, state) {
        const freeItemsPerLine = state.buy_x_get_y_free.freeItemsPerLine;
        const qualifyingQuantity = freeItemsPerLine[orderLine.id];
        if (qualifyingQuantity) {
            const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
            return -unitPrice * (args.discountPercentage / 100) * (qualifyingQuantity / orderLine.quantity);
        }
        return 0;
    },
});
