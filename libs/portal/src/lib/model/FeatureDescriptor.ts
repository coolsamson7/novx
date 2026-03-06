/**
 * This is a generated file, do NOT edit manually!
 * Generator: AxiosClientGenerator V1.0 based on (OpenAPI-Generator https://openapi-generator.tech)
 */

import { ClientConstraints, ClientConstraintsSchema } from './ClientConstraints'
import { schema, enumeration, oneOf, string, object, boolean, number, array, record, reference, date } from "@novx/core"



export interface FeatureDescriptor {
  /**
   * the id
   */
  id: string;
  /**
   * optional i18n key
   */
  i18n?: string;
  preloadI18n?: string[];
  label?: string;
  path?: string | null;
  icon?: string;
  lazy?: boolean;
  enabled?: boolean;
  component: string;
  tags?: Array<string>;
  permissions?: Array<string>;
  visibility?: Array<string>;
  sourceFile?: string;
  features?: Array<string>;
  clients?: ClientConstraints | null;
}


/**
* the schema for {@link FeatureDescriptor}
*/
export const FeatureDescriptorSchema = schema(
  'Feature',
  object({
    id: string().required(),
    label: string().required(),
    path: string().optional().nullable(),
    icon: string().optional(),
    i18n: string().optional(),
    enabled: boolean().optional(),
    lazy: boolean().optional(),
    component: string().required(),
    tags: array(string()).optional(),
    permissions: array(string()).optional(),
    visibility: array(string()).optional(),
    sourceFile: string().optional(),
    features: array(string()).optional(),
    clients: reference(ClientConstraintsSchema).optional().nullable(),
  }),
);




