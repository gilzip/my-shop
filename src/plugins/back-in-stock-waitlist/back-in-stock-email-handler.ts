import { EmailEventListener } from '@vendure/email-plugin';

import { BackInStockEvent } from './back-in-stock.event';

export const BACK_IN_STOCK_METADATA_KEY = 'backInStockWaitlist';

// No product link on purpose: this repository has no storefront URL to link to.
export const backInStockEmailHandler = new EmailEventListener('back-in-stock')
    .on(BackInStockEvent)
    .setRecipient(event => event.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('{{ variantName }} is back in stock')
    .setTemplateVars(event => ({ variantName: event.variant.name, sku: event.variant.sku }))
    // Lets the plugin recognise a failed send of THIS email when EmailPlugin publishes EmailSendEvent.
    .setMetadata(event => ({ [BACK_IN_STOCK_METADATA_KEY]: true, productVariantId: event.variant.id }));
