export * from './parseJWT'

import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'

import type { SupportedAuthTypes } from '@redwoodjs/auth'

import { decodeToken } from './decoders'

// This is shared by `@redwoodjs/web`
const AUTH_PROVIDER_HEADER = 'auth-provider'

export const getAuthProviderHeader = (
  event: APIGatewayProxyEvent
): SupportedAuthTypes => {
  return event?.headers[AUTH_PROVIDER_HEADER] as SupportedAuthTypes
}

export interface AuthorizationHeader {
  schema: 'Bearer' | 'Basic' | string
  token: string
}
/**
 * Split the `Authorization` header into a schema and token part.
 */
export const parseAuthorizationHeader = (
  event: APIGatewayProxyEvent
): AuthorizationHeader => {
  const parts = (
    event.headers?.authorization || event.headers?.Authorization
  )?.split(' ')
  if (parts?.length !== 2) {
    throw new Error('The `Authorization` header is not valid.')
  }
  const [schema, token] = parts
  if (!schema.length || !token.length) {
    throw new Error('The `Authorization` header is not valid.')
  }
  return { schema, token }
}

/**
 * A "thruple" of
 * [0] - decoded JWT (if possible), or the token-string itself, or null
 * [1] - type of auth, decided by the decoder & headers
 * [2] - event + context
 */
export type AuthContextPayload = [
  Record<string, unknown> | string | null,
  { type: SupportedAuthTypes } & AuthorizationHeader,

  // @TODO remove from AuthContextPayload
  { event: APIGatewayProxyEvent; context: LambdaContext }
]

/**
 * Get the authorization information from the request headers and request context.
 * @returns [decoded, { type, schema, token }, { event, context }]
 **/
export const getAuthenticationContext = async ({
  event,
  context,
}: {
  event: APIGatewayProxyEvent
  context: LambdaContext
}): Promise<undefined | AuthContextPayload> => {
  const type = getAuthProviderHeader(event)
  // No `auth-provider` header means that the user is logged out,
  // and none of this auth malarky is required.
  if (!type) {
    return undefined
  }

  let decoded = null
  const { schema, token } = parseAuthorizationHeader(event)
  decoded = await decodeToken(type, token, { event, context })
  return [decoded, { type, schema, token }, { event, context }]
}
