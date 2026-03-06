/**
 * This is a generated file, do NOT edit manually!
 * Generator: AxiosClientGenerator V1.0 based on (OpenAPI-Generator https://openapi-generator.tech)
 */

import { schema, enumeration, oneOf, string, object, boolean, number, array, record, reference, date } from "@novx/core"


/**
 * coves the client characteristics of a device
 */
export interface ClientInfo {
    /**
     * width in px
     */
    width: number
    /**
     * height in px
     */
    height: number
    screen_size: string
    orientation: string
    pixel_ratio: number
    platform: string
    browser: string
    os: string
    os_version: string
    capabilities: Array<string>
    device_type?: string | null
}


/**
* the schema for {@link ClientInfo}
*/
export const ClientInfoSchema = schema("ClientInfo", object({
   width: number().required(),
   height: number().required(),
   screen_size: string().required(),
   orientation: string().required(),
   pixel_ratio: number().required(),
   platform: string().required(),
   browser: string().required(),
   os: string().required(),
   os_version: string().required(),
   capabilities: array(string()).required(),
   device_type: oneOf('phone', 'tablet', 'desktop').optional().nullable(),
}))




