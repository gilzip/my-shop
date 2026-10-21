import type { CustomFieldConfig, CustomFields, Injector, RequestContext } from '@vendure/core';

type Validate = (value: unknown, injector: Injector, ctx: RequestContext) => unknown;

/**
 * Makes every custom field customer-invisible unless it says otherwise.
 *
 * Vendure's own default is `public: true`, which exposes a field on the Shop API
 * (readable and, unless `readonly`, writable by customers). That default leaked three
 * internal test fields (see .ai/work/protect-internal-custom-fields/). Wrapping the
 * `customFields` config with this function flips the default: a field that omits
 * `public` gets `public: false` (Shop API hidden, Admin API/dashboard unchanged).
 * Exposing a field to customers therefore always takes an explicit `public: true`.
 *
 * Every non-public field also gets a Shop API write guard. When all of an entity's
 * custom fields are non-public, Vendure types its Shop `Create/Update<Entity>Input.customFields`
 * as `JSON`, which would otherwise let a customer write any of them. The guard rides on
 * the field's own `validate` hook, which Vendure runs for every submitted value; it
 * rejects Shop API writes and delegates to the field's original `validate` otherwise.
 *
 * Fields added later by a plugin's own `configuration` hook are not covered - such
 * plugins must set `public` explicitly (see AGENTS.md).
 */
export function internalByDefault(customFields: CustomFields): CustomFields {
    const result: CustomFields = {};
    for (const [entityName, fields] of Object.entries(customFields)) {
        (result as Record<string, unknown>)[entityName] = fields?.map(withVisibilityDefaults);
    }
    return result;
}

function withVisibilityDefaults(field: CustomFieldConfig): CustomFieldConfig {
    const config = { public: false, ...field } as CustomFieldConfig;
    if (config.public !== false) {
        return config;
    }
    const originalValidate = field.validate as Validate | undefined;
    const validate: Validate = (value, injector, ctx) => {
        if (ctx?.apiType === 'shop') {
            return `Custom field "${field.name}" cannot be set via the Shop API.`;
        }
        return originalValidate?.(value, injector, ctx);
    };
    return { ...config, validate } as CustomFieldConfig;
}
