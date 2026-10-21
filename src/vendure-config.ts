import {
    dummyPaymentHandler,
    defaultShippingEligibilityChecker,
    defaultShippingCalculator,
    defaultPromotionConditions,
    defaultPromotionActions,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    LanguageCode,
    VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { applePaySimulatedHandler } from './payment-methods/apple-pay-simulated-handler';
import { freeShippingIsraelChecker } from './shipping-methods/free-shipping-israel-checker';
import { isFirstOrderCondition } from './promotions/is-first-order-condition';
import { buyXGetYDiscountAction } from './promotions/buy-x-get-y-discount-action';
import { OrderSelfCancellationPlugin } from './plugins/order-self-cancellation/order-self-cancellation.plugin';
import { internalByDefault } from './custom-fields/internal-by-default';

const IS_DEV = process.env.APP_ENV === 'dev';
// PORT wins because hosting platforms inject it into the environment at runtime, and that
// must take precedence over any value baked into the .env file at scaffold time.
const serverPort = +process.env.PORT || +process.env.VENDURE_SERVER_PORT || 3000;

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'better-sqlite3',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: false,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: path.join(__dirname, '../vendure.sqlite'),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler, applePaySimulatedHandler],
    },
    // Must list the framework defaults explicitly alongside any custom checker/calculator -
    // mergeConfig replaces this array wholesale rather than merging it, so omitting the
    // defaults here would break the existing standard-shipping/express-shipping methods.
    shippingOptions: {
        shippingEligibilityCheckers: [defaultShippingEligibilityChecker, freeShippingIsraelChecker],
        shippingCalculators: [defaultShippingCalculator],
    },
    // Spreading defaultPromotionConditions (rather than hand-listing them) so this
    // doesn't silently go stale if a future Vendure upgrade adds another built-in condition.
    promotionOptions: {
        promotionConditions: [...defaultPromotionConditions, isFirstOrderCondition],
        promotionActions: [...defaultPromotionActions, buyXGetYDiscountAction],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    // internalByDefault: a field without `public` is hidden from the Shop API;
    // exposing one to customers takes an explicit `public: true` (see AGENTS.md).
    customFields: internalByDefault({
        ProductVariant: [
            {
                name: 'internalNote',
                type: 'text',
                nullable: true,
                public: false,
                label: [{ languageCode: LanguageCode.en, value: 'Internal note' }],
                description: [{
                    languageCode: LanguageCode.en,
                    value: 'Internal-only note for warehouse/product staff. Never shown to customers.',
                }],
            },
        ],
        Customer: [
            {
                name: 'GilTest',
                type: 'int',
                nullable: true,
                public: false,
                label: [{ languageCode: LanguageCode.en, value: 'GilTest (pipeline test field)' }],
                description: [{
                    languageCode: LanguageCode.en,
                    value: 'Internal pipeline test field - no business meaning. Never shown to customers.',
                }],
            },
            {
                name: 'internalNote',
                type: 'text',
                nullable: true,
                public: false,
                label: [{ languageCode: LanguageCode.en, value: 'Internal note' }],
                description: [{
                    languageCode: LanguageCode.en,
                    value: 'Internal-only note for back-office staff. Never shown to customers.',
                }],
            },
            {
                name: 'dror_cust',
                type: 'text',
                nullable: true,
                public: false,
                label: [{ languageCode: LanguageCode.en, value: 'dror_cust (pipeline test field)' }],
                description: [{
                    languageCode: LanguageCode.en,
                    value: 'Internal pipeline test field - no default, no backfill. Never shown to customers.',
                }],
            },
        ],
        Payment: [
            {
                name: 'gil_payment',
                type: 'int',
                defaultValue: 99999,
                nullable: true,
                public: false,
                label: [{ languageCode: LanguageCode.en, value: 'gil_payment (pipeline test field)' }],
                description: [{
                    languageCode: LanguageCode.en,
                    value: 'Internal pipeline test field - defaults to 99999, no business meaning. Never shown to customers.',
                }],
            },
        ],
    }),
    plugins: [
        OrderSelfCancellationPlugin,
        GraphiqlPlugin.init(),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url.
            assetUrlPrefix: IS_DEV ? undefined : 'https://www.my-shop.com/assets/',
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: {
                // The following variables will change depending on your storefront implementation.
                // Here we are assuming a storefront running at http://localhost:8080.
                fromAddress: '"example" <noreply@example.com>',
                verifyEmailAddressUrl: 'http://localhost:8080/verify',
                passwordResetUrl: 'http://localhost:8080/password-reset',
                changeEmailAddressUrl: 'http://localhost:8080/verify-email-address-change'
            },
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
