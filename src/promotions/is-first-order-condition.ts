import { Injector, LanguageCode, Order, OrderService, PromotionCondition } from '@vendure/core';

let orderService: OrderService;

export const isFirstOrderCondition = new PromotionCondition({
    code: 'is_first_order',
    description: [{
        languageCode: LanguageCode.en,
        value: "Applies only to the customer's first placed order",
    }],
    args: {},
    async init(injector: Injector) {
        orderService = injector.get(OrderService);
    },
    async check(ctx, order: Order) {
        if (!order.customer) {
            return false;
        }
        const priorOrders = await orderService.findByCustomerId(ctx, order.customer.id);
        const hasAnyOtherPlacedOrder = priorOrders.items.some(
            o => o.id !== order.id && o.orderPlacedAt != null,
        );
        return !hasAnyOtherPlacedOrder;
    },
});
