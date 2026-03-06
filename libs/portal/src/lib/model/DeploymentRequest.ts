/**
 * This is a generated file, do NOT edit manually!
 * Generator: AxiosClientGenerator V1.0 based on (OpenAPI-Generator https://openapi-generator.tech)
 */

import { ClientInfo, ClientInfoSchema } from './ClientInfo'
import { schema, enumeration, oneOf, string, object, boolean, number, array, record, reference, date } from "@novx/core"


/**
 * a {@link DeploymentRequest} covers the necessary information to compute a {@link Deployment}
 */
export interface DeploymentRequest {
    /**
     * the application name
     */
    application: string
    /**
     * the {@link ClientInfo} of the requesting browser
     */
    client: ClientInfo
}


/**
* the schema for {@link DeploymentRequest}
*/
export const DeploymentRequestSchema = schema("DeploymentRequest", object({
   application: string().required(),
   client: reference(ClientInfoSchema).required(),
}))




