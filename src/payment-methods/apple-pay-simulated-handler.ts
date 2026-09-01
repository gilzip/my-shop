import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

/**
 * Simulated Apple Pay handler for the PoC — no real Apple Merchant ID, no real
 * payment gateway. In a production integration, the storefront would run the
 * real ApplePaySession JS flow and hand the resulting encrypted payment token
 * to this handler's `metadata.applePayToken`, which would then be forwarded to
 * a PSP (e.g. Stripe/Adyen) for decryption and authorization. Here we treat
 * receipt of a (simulated) token as sufficient to settle the payment.
 *
 * Metadata flags let a caller simulate the two ways a real attempt can fail
 * without needing real Apple/device conditions:
 * - `deviceNotEligible`: the customer's browser/device can't use Apple Pay.
 * - `shouldDecline`: the (simulated) issuing bank declined the payment.
 */
export const applePaySimulatedHandler = new PaymentMethodHandler({
    code: 'apple-pay-simulated',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Apple Pay (Simulated)',
        },
    ],
    args: {
        merchantDisplayName: {
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'Merchant display name' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value: 'The name shown to the customer in the (simulated) Apple Pay sheet. ' +
                        'In a real integration this stands in for the registered Apple Merchant ID.',
                },
            ],
            required: true,
            defaultValue: 'My Shop',
        },
    },
    createPayment: async (ctx, order, amount, args, metadata) => {
        if (metadata.deviceNotEligible) {
            return {
                amount,
                state: 'Declined' as const,
                metadata: {
                    errorMessage: 'Apple Pay is not available on this device or browser.',
                },
            };
        }
        if (metadata.shouldDecline) {
            return {
                amount,
                state: 'Declined' as const,
                metadata: {
                    errorMessage: 'The payment was declined by the (simulated) issuing bank.',
                },
            };
        }
        // Apple Pay is a single-step flow in practice: the PSP authorizes and
        // captures in one call, so we settle immediately.
        return {
            amount,
            state: 'Settled' as const,
            transactionId: `apple-pay-sim-${Math.random().toString(36).slice(2, 11)}`,
            metadata: {
                merchantDisplayName: args.merchantDisplayName,
                simulatedCard: 'Visa •••• 4242',
            },
        };
    },
    settlePayment: async () => {
        return { success: true };
    },
    cancelPayment: async () => {
        return {
            success: true,
            metadata: {
                cancellationDate: new Date().toISOString(),
            },
        };
    },
});
